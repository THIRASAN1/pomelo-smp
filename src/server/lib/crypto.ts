import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

/**
 * Hash an IP address with the server secret — keeps raw IPs out of the DB
 * while still allowing per-IP rate-limit / dedup checks.
 */
export function hashIp(ip: string): string {
  return createHmac('sha256', env.APP_SECRET).update(ip).digest('hex').slice(0, 32);
}

/** Generate a URL-safe opaque token. */
export function randomToken(bytes = 18): string {
  // base64url without padding — 18 bytes → 24 chars
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Constant-time string compare (prevents timing attacks). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Short fingerprint of arbitrary string (for logging / cache keys). */
export function fingerprint(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 10);
}
