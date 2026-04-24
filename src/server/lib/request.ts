import { env } from '../env';
import { AppError } from './errors';
import { randomToken } from './crypto';

/**
 * Extract the client IP from common reverse-proxy headers, falling back to
 * Astro's ClientAddress (which also uses the request's remote address).
 *
 * Trust chain: we only trust proxy headers if the server is deployed behind
 * a trusted reverse proxy — this is configured via ALLOWED_ORIGINS + the
 * security layer in your deployment (e.g. Caddy, nginx, Cloudflare).
 */
export function clientIp(req: Request, clientAddress?: string): string {
  // X-Forwarded-For: "client, proxy1, proxy2" — leftmost is originator
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();

  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();

  const cfConnecting = req.headers.get('cf-connecting-ip');
  if (cfConnecting) return cfConnecting.trim();

  return clientAddress ?? 'unknown';
}

/** Generate a short request id (useful for correlating logs + responses). */
export function newRequestId(): string {
  return randomToken(9);
}

/**
 * CSRF / cross-origin protection for state-changing endpoints.
 * Verifies the request's Origin (or Referer fallback) is in the allow-list.
 * Throws an AppError if the check fails.
 */
export function assertSameOrigin(req: Request): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;

  // Content-Type guard — reject the simple-request form bodies that browsers
  // send cross-origin without pre-flight (classic CSRF vector).
  const ct = (req.headers.get('content-type') ?? '').toLowerCase();
  const isForm = ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data');
  if (isForm) {
    throw new AppError('forbidden', 'Unsupported content type for this endpoint');
  }

  const origin = req.headers.get('origin') ?? deriveOriginFromReferer(req.headers.get('referer'));
  if (!origin) {
    throw new AppError('forbidden', 'Missing Origin header');
  }
  if (!env.ALLOWED_ORIGINS.includes(origin)) {
    throw new AppError('forbidden', 'Origin not allowed');
  }
}

function deriveOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
