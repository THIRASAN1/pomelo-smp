import type { APIRoute } from 'astro';
import { WhitelistIdSchema } from '../../../server/schemas/whitelist';
import { getApplicationById } from '../../../server/services/whitelist';
import { checkRateLimit } from '../../../server/lib/rate-limit';
import { clientIp } from '../../../server/lib/request';
import { hashIp } from '../../../server/lib/crypto';
import { env } from '../../../server/env';
import { AppError, json, toErrorResponse } from '../../../server/lib/errors';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, clientAddress, locals }) => {
  try {
    const id = WhitelistIdSchema.parse(params.id);

    const ip = clientIp(request, clientAddress);
    const rl = await checkRateLimit({
      key: `status:${hashIp(ip)}`,
      limit: env.RATE_LIMIT_API_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      throw new AppError('rate_limited', 'Too many requests — try again shortly');
    }

    const app = await getApplicationById(id);
    if (!app) {
      throw new AppError('not_found', 'ไม่พบใบสมัครนี้');
    }

    return json({ data: app, requestId: locals.requestId });
  } catch (err) {
    return toErrorResponse(err, locals.requestId);
  }
};
