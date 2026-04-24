import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { rateLimits } from '../db/schema';
import { logger } from './logger';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms
  retryAfterSec?: number;
};

/**
 * Fixed-window rate limiter backed by SQLite (libsql).
 * Cheap, durable across restarts, good enough up to a few thousand req/s per node.
 * Upgrade to Redis + sliding-window if you need distributed counters.
 */
export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowMs } = opts;
  const now = opts.now ?? Date.now();
  const bucket = String(Math.floor(now / windowMs));
  const expiresAt = (Math.floor(now / windowMs) + 1) * windowMs;

  // UPSERT via INSERT ... ON CONFLICT (handled inside a transaction to be
  // atomic w.r.t. concurrent requests for the same key+bucket).
  const hits = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ hits: rateLimits.hits })
      .from(rateLimits)
      .where(and(eq(rateLimits.key, key), eq(rateLimits.bucket, bucket)))
      .limit(1);

    if (existing.length === 0) {
      await tx
        .insert(rateLimits)
        .values({ key, bucket, hits: 1, expiresAt: new Date(expiresAt) });
      return 1;
    }

    const next = existing[0]!.hits + 1;
    await tx
      .update(rateLimits)
      .set({ hits: next })
      .where(and(eq(rateLimits.key, key), eq(rateLimits.bucket, bucket)));
    return next;
  });

  // Opportunistic GC of stale rows (cheap: indexed by expiresAt).
  if (Math.random() < 0.02) {
    try {
      await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)));
    } catch (err) {
      logger.warn({ err }, 'rate-limit GC failed');
    }
  }

  const remaining = Math.max(0, limit - hits);
  const allowed = hits <= limit;
  return {
    allowed,
    remaining,
    limit,
    resetAt: expiresAt,
    retryAfterSec: allowed ? undefined : Math.ceil((expiresAt - now) / 1000),
  };
}
