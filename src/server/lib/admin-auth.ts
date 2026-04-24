import type { APIContext } from 'astro';
import { env } from '../env';
import { AppError } from './errors';
import { getSession, readSessionCookie } from './session';
import type { AdminSession } from '../db/schema';

export function isAdminEnabled(): boolean {
  return Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH);
}

/**
 * Resolve the current admin session for a request. Returns null if unauthenticated.
 * Use `requireAdmin` when you need to enforce auth (throws on missing session).
 */
export async function getCurrentAdmin(ctx: Pick<APIContext, 'cookies'>): Promise<AdminSession | null> {
  if (!isAdminEnabled()) return null;
  const token = readSessionCookie(ctx.cookies);
  return token ? await getSession(token) : null;
}

export async function requireAdmin(ctx: Pick<APIContext, 'cookies'>): Promise<AdminSession> {
  if (!isAdminEnabled()) {
    throw new AppError('not_found', 'Admin panel is not configured', { expose: false });
  }
  const session = await getCurrentAdmin(ctx);
  if (!session) {
    throw new AppError('unauthorized', 'Authentication required');
  }
  return session;
}
