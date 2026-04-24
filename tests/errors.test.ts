import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AppError, json, toErrorResponse } from '../src/server/lib/errors';

describe('json helper', () => {
  it('returns a Response with JSON content-type', async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('defaults to no-store cache header', () => {
    expect(json({}).headers.get('cache-control')).toBe('no-store');
  });

  it('allows overriding cache-control', () => {
    const res = json({}, 200, { 'cache-control': 'max-age=30' });
    expect(res.headers.get('cache-control')).toBe('max-age=30');
  });
});

describe('toErrorResponse', () => {
  it('serialises AppError with the correct HTTP status', async () => {
    const res = toErrorResponse(new AppError('not_found', 'gone'), 'req-1');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string; requestId: string } };
    expect(body.error).toEqual({ code: 'not_found', message: 'gone', requestId: 'req-1' });
  });

  it('hides internal messages when expose=false', async () => {
    const res = toErrorResponse(new AppError('internal_error', 'db down', { expose: false }));
    const body = (await res.json()) as { error: { message: string; details?: unknown } };
    expect(body.error.message).toBe('Request failed');
    expect(body.error.details).toBeUndefined();
  });

  it('converts ZodError into a 422 with field details', async () => {
    const schema = z.object({ age: z.number().int().min(10) });
    try {
      schema.parse({ age: 5 });
    } catch (err) {
      const res = toErrorResponse(err, 'req-2');
      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { code: string; details: unknown[] } };
      expect(body.error.code).toBe('validation_failed');
      expect(Array.isArray(body.error.details)).toBe(true);
      expect(body.error.details.length).toBeGreaterThan(0);
      return;
    }
    throw new Error('expected zod parse to throw');
  });

  it('hides internals for unknown errors', async () => {
    const res = toErrorResponse(new Error('boom stacktrace'), 'req-3');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal_error');
    expect(body.error.message).toBe('Internal server error');
  });
});
