import type { APIRoute } from 'astro';
import { assertSameOrigin } from '../../../server/lib/request';
import { clearSessionCookie, destroySession, readSessionCookie } from '../../../server/lib/session';
import { json, toErrorResponse } from '../../../server/lib/errors';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    assertSameOrigin(request);
    const token = readSessionCookie(cookies);
    if (token) {
      await destroySession(token);
      clearSessionCookie(cookies);
    }
    return json({ data: { ok: true }, requestId: locals.requestId });
  } catch (err) {
    return toErrorResponse(err, locals.requestId);
  }
};
