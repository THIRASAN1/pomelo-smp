import type { APIRoute } from 'astro';
import { WhitelistInputSchema } from '../../server/schemas/whitelist';
import { submitApplication } from '../../server/services/whitelist';
import { checkRateLimit } from '../../server/lib/rate-limit';
import { assertSameOrigin, clientIp } from '../../server/lib/request';
import { hashIp } from '../../server/lib/crypto';
import { env } from '../../server/env';
import { AppError, json, toErrorResponse } from '../../server/lib/errors';
import { logger } from '../../server/lib/logger';

export const prerender = false;

// Hard cap on request body size (defense-in-depth against DoS).
const MAX_BODY_BYTES = 8 * 1024; // 8 KB is plenty for this form

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  try {
    // 1) Origin check (cheap) — blocks CSRF and most bot traffic.
    assertSameOrigin(request);

    // 2) Content-type must be JSON.
    const ct = (request.headers.get('content-type') ?? '').toLowerCase();
    if (!ct.startsWith('application/json')) {
      throw new AppError('bad_request', 'Content-Type must be application/json');
    }

    // 3) Size guard — read as text first so we can enforce a byte cap before parsing JSON.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      throw new AppError('bad_request', 'Request body too large');
    }

    // 4) Rate limit per IP (fixed window, persisted in SQLite so it survives restarts).
    const ip = clientIp(request, clientAddress);
    const rl = await checkRateLimit({
      key: `whitelist:${hashIp(ip)}`,
      limit: env.RATE_LIMIT_WHITELIST_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      throw new AppError(
        'rate_limited',
        `ส่งใบสมัครเกินจำนวนที่กำหนดแล้ว (${rl.limit} ครั้ง/ชั่วโมง) ลองใหม่ในอีก ~${Math.ceil((rl.retryAfterSec ?? 60) / 60)} นาที`,
      );
    }

    // 5) Parse + validate input.
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new AppError('bad_request', 'Invalid JSON body');
    }
    const input = WhitelistInputSchema.parse(payload);

    // 6) Persist + fire webhook (inside service).
    const app = await submitApplication(input, {
      ip,
      userAgent: request.headers.get('user-agent'),
    });

    return json(
      {
        data: {
          id: app.id,
          status: app.status,
          message:
            'ส่งใบสมัครแล้ว! ทีมงานจะพิจารณาภายใน 24 ชม. เก็บ id นี้ไว้สำหรับเช็กสถานะ',
        },
        requestId: locals.requestId,
      },
      201,
      {
        'x-ratelimit-limit': String(rl.limit),
        'x-ratelimit-remaining': String(rl.remaining),
        'x-ratelimit-reset': String(Math.floor(rl.resetAt / 1000)),
      },
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      logger.error({ err, requestId: locals.requestId }, 'whitelist POST failed');
    }
    return toErrorResponse(err, locals.requestId);
  }
};

// Method-not-allowed helper (keeps noise out of logs for GET/HEAD attempts).
export const ALL: APIRoute = ({ request, locals }) => {
  if (request.method === 'POST') return new Response(null); // never reached
  return json(
    { error: { code: 'bad_request', message: `Method ${request.method} not allowed`, requestId: locals.requestId } },
    405,
    { allow: 'POST' },
  );
};
