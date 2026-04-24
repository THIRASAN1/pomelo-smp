import { and, eq, gt, lt } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { db } from '../db/client';
import { adminSessions, type AdminSession } from '../db/schema';
import { env, isProd } from '../env';
import { hashIp, randomToken } from './crypto';
import { logger } from './logger';

export const SESSION_COOKIE = 'pomelo_admin';

/**
 * Create an admin session row + return the cookie value to set.
 * The cookie value IS the session id (opaque random token), looked up in DB on each request.
 */
export async function createSession(
  username: string,
  meta: { ip: string; userAgent: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const ttlMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.insert(adminSessions).values({
    id: token,
    username,
    ipHash: hashIp(meta.ip),
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
    expiresAt,
  });

  logger.info({ username, ipHash: hashIp(meta.ip) }, 'admin session created');
  return { token, expiresAt };
}

/** Read the session row for a cookie token. Returns null if expired / unknown. */
export async function getSession(token: string | null | undefined): Promise<AdminSession | null> {
  if (!token || typeof token !== 'string' || token.length < 16) return null;

  const rows = await db
    .select()
    .from(adminSessions)
    .where(and(eq(adminSessions.id, token), gt(adminSessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, token));
}

/** Opportunistic cleanup of expired sessions. Cheap, indexed. */
export async function gcExpiredSessions(): Promise<void> {
  try {
    await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  } catch (err) {
    logger.warn({ err }, 'admin session GC failed');
  }
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

export function setSessionCookie(
  cookies: AstroCookies,
  token: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE)?.value;
}
