import { defineMiddleware } from 'astro:middleware';
import { env, isProd } from './server/env';
import { logger } from './server/lib/logger';
import { newRequestId } from './server/lib/request';
import { getCurrentAdmin, isAdminEnabled } from './server/lib/admin-auth';

/**
 * Global Astro middleware:
 *   1. attach a request id
 *   2. log request/response timing
 *   3. set security headers on every response
 */

// Content-Security-Policy is assembled per-request so each response carries
// a unique nonce that whitelists our one inline JSON-LD block (and nothing else).
// In dev Astro injects inline HMR scripts we can't easily nonce — relax
// script-src in dev only. Production stays strict nonce-only.
function buildCsp(nonce: string): string {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}'`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`;
  const connectSrc = isProd
    ? "connect-src 'self' https://api.mcsrvstat.us"
    : "connect-src 'self' https://api.mcsrvstat.us ws: wss:"; // allow Vite HMR websocket

  return [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    scriptSrc,
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

function securityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-security-policy': buildCsp(nonce),
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'x-dns-prefetch-control': 'off',
  };
  if (isProd) {
    // HSTS only makes sense over HTTPS in production.
    headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload';
  }
  return headers;
}

/** Short random nonce for CSP. 128 bits of entropy is plenty. */
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const started = performance.now();
  const requestId = newRequestId();
  const cspNonce = randomNonce();
  ctx.locals.requestId = requestId;
  ctx.locals.cspNonce = cspNonce;
  const path = ctx.url.pathname;

  // ─── Admin auth gate ────────────────────────────────────────────────────
  // /admin/login and /api/admin/login are public (they're how you authenticate).
  // Everything else under /admin/* and /api/admin/* requires a valid session.
  const isAdminArea =
    (path === '/admin' || path.startsWith('/admin/')) ||
    path.startsWith('/api/admin/');
  const isAdminAuthPublic =
    path === '/admin/login' ||
    path === '/api/admin/login' ||
    path === '/api/admin/logout';

  if (isAdminArea && !isAdminAuthPublic) {
    if (!isAdminEnabled()) {
      return new Response('Admin panel is not configured', { status: 404 });
    }
    const session = await getCurrentAdmin(ctx);
    if (!session) {
      // HTML request → redirect to login; API request → 401 JSON.
      if (path.startsWith('/api/')) {
        return new Response(
          JSON.stringify({
            error: { code: 'unauthorized', message: 'Authentication required', requestId },
          }),
          { status: 401, headers: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': requestId } },
        );
      }
      return Response.redirect(new URL('/admin/login', ctx.url), 302);
    }
  }

  // Run the handler
  let response: Response;
  try {
    response = await next();
  } catch (err) {
    logger.error({ err, requestId, url: ctx.url.pathname }, 'unhandled middleware error');
    response = new Response(
      JSON.stringify({ error: { code: 'internal_error', message: 'Internal server error', requestId } }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  // Admin surfaces must never be indexed by search engines.
  if (isAdminArea) {
    response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    response.headers.set('cache-control', 'no-store, must-revalidate');
  }

  // Set security + diagnostic headers.
  for (const [k, v] of Object.entries(securityHeaders(cspNonce))) {
    if (!response.headers.has(k)) response.headers.set(k, v);
  }
  response.headers.set('x-request-id', requestId);

  const duration = (performance.now() - started).toFixed(1);
  logger.debug(
    {
      requestId,
      method: ctx.request.method,
      path: ctx.url.pathname,
      status: response.status,
      duration_ms: Number(duration),
    },
    'req',
  );

  return response;
});

// augment Astro's Locals with per-request values populated by this middleware
declare global {
  namespace App {
    interface Locals {
      requestId: string;
      cspNonce: string;
    }
  }
}

// Suppress unused-import warning — `env` import keeps the module side-effect validating envs.
void env;
