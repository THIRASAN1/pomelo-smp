import type { APIRoute } from 'astro';
import { sqlite } from '../../server/db/client';
import { json, toErrorResponse } from '../../server/lib/errors';
import { logger } from '../../server/lib/logger';

export const prerender = false;

const startedAt = Date.now();

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Lightweight DB probe — raw query, no ORM overhead.
    const res = await sqlite.execute('SELECT 1 as ok');
    const dbOk = res.rows[0]?.ok === 1;

    return json(
      {
        status: dbOk ? 'ok' : 'degraded',
        uptime_sec: Math.round((Date.now() - startedAt) / 1000),
        db: dbOk ? 'up' : 'down',
        version: '1.0.0',
        requestId: locals.requestId,
      },
      dbOk ? 200 : 503,
    );
  } catch (err) {
    logger.warn({ err, requestId: locals.requestId }, 'health probe failed');
    return toErrorResponse(err, locals.requestId);
  }
};
