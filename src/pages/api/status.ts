import type { APIRoute } from 'astro';
import { getServerStatus } from '../../server/services/minecraft';
import { checkRateLimit } from '../../server/lib/rate-limit';
import { clientIp } from '../../server/lib/request';
import { hashIp } from '../../server/lib/crypto';
import { env } from '../../server/env';
import { AppError, toErrorResponse, json } from '../../server/lib/errors';

export const prerender = false;

export const GET: APIRoute = async ({ request, clientAddress, locals }) => {
  try {
    const ip = clientIp(request, clientAddress);
    const rl = await checkRateLimit({
      key: `status:${hashIp(ip)}`,
      limit: env.RATE_LIMIT_API_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      throw new AppError('rate_limited', 'Too many requests — try again shortly', {
        details: { retryAfterSec: rl.retryAfterSec },
      });
    }

    const status = await getServerStatus();
    return json({ data: status, requestId: locals.requestId }, 200, {
      // CDN / browsers may cache for 15s, server responds with 30s cache internally.
      'cache-control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
      'x-ratelimit-limit': String(rl.limit),
      'x-ratelimit-remaining': String(rl.remaining),
      'x-ratelimit-reset': String(Math.floor(rl.resetAt / 1000)),
    });
  } catch (err) {
    return toErrorResponse(err, locals.requestId);
  }
};
