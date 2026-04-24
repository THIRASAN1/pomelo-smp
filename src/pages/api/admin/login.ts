import type { APIRoute } from 'astro';
import { env } from '../../../server/env';
import { LoginSchema } from '../../../server/schemas/admin';
import { verifyPassword } from '../../../server/lib/password';
import { safeEqual } from '../../../server/lib/crypto';
import { checkRateLimit } from '../../../server/lib/rate-limit';
import { clientIp, assertSameOrigin } from '../../../server/lib/request';
import { hashIp } from '../../../server/lib/crypto';
import { AppError, json, toErrorResponse } from '../../../server/lib/errors';
import { createSession, setSessionCookie } from '../../../server/lib/session';
import { isAdminEnabled } from '../../../server/lib/admin-auth';
import { logger } from '../../../server/lib/logger';
import { recordAudit } from '../../../server/services/audit';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress, cookies, locals }) => {
  try {
    assertSameOrigin(request);

    if (!isAdminEnabled()) {
      throw new AppError('not_found', 'Admin panel is not configured', { expose: false });
    }

    const ct = (request.headers.get('content-type') ?? '').toLowerCase();
    if (!ct.startsWith('application/json')) {
      throw new AppError('bad_request', 'Content-Type must be application/json');
    }

    // Rate limit: 5 login attempts / 15 minutes / IP.
    const ip = clientIp(request, clientAddress);
    const rl = await checkRateLimit({
      key: `admin-login:${hashIp(ip)}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      throw new AppError(
        'rate_limited',
        `ล็อกอินผิดเกินจำนวน — ลองใหม่ในอีก ~${Math.ceil((rl.retryAfterSec ?? 60) / 60)} นาที`,
      );
    }

    const raw = await request.text();
    if (raw.length > 2_048) throw new AppError('bad_request', 'Body too large');

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new AppError('bad_request', 'Invalid JSON body');
    }

    const { username, password } = LoginSchema.parse(payload);

    // Always run the password hash, even if the username is wrong, to avoid
    // revealing (via timing) whether the username exists.
    const usernameOk = safeEqual(username, env.ADMIN_USERNAME ?? '');
    const passwordOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH ?? 'scrypt:0:0');
    if (!usernameOk || !passwordOk) {
      logger.warn({ username, ipHash: hashIp(ip) }, 'admin login failed');
      void recordAudit({
        actor: username,
        action: 'admin.login.failed',
        ipHash: hashIp(ip),
        metadata: { reason: usernameOk ? 'bad_password' : 'bad_username' },
      });
      throw new AppError('unauthorized', 'Invalid credentials');
    }

    const { token, expiresAt } = await createSession(username, {
      ip,
      userAgent: request.headers.get('user-agent'),
    });
    setSessionCookie(cookies, token, expiresAt);

    void recordAudit({
      actor: username,
      action: 'admin.login',
      ipHash: hashIp(ip),
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return json({ data: { username, expiresAt: expiresAt.toISOString() }, requestId: locals.requestId }, 200);
  } catch (err) {
    return toErrorResponse(err, locals.requestId);
  }
};
