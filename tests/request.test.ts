import { describe, it, expect } from 'vitest';
import { assertSameOrigin, clientIp, newRequestId } from '../src/server/lib/request';
import { AppError } from '../src/server/lib/errors';

function req(
  method: string,
  headers: Record<string, string> = {},
  body: string | null = null,
): Request {
  return new Request('http://localhost:4321/api/test', {
    method,
    headers,
    body,
  });
}

describe('clientIp', () => {
  it('prefers X-Forwarded-For leftmost entry', () => {
    const r = req('GET', { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' });
    expect(clientIp(r, '9.9.9.9')).toBe('1.1.1.1');
  });

  it('falls back to X-Real-IP', () => {
    const r = req('GET', { 'x-real-ip': '4.4.4.4' });
    expect(clientIp(r, '9.9.9.9')).toBe('4.4.4.4');
  });

  it('falls back to CF-Connecting-IP', () => {
    const r = req('GET', { 'cf-connecting-ip': '5.5.5.5' });
    expect(clientIp(r, '9.9.9.9')).toBe('5.5.5.5');
  });

  it('falls back to clientAddress when no headers', () => {
    expect(clientIp(req('GET'), '9.9.9.9')).toBe('9.9.9.9');
  });

  it('returns "unknown" if nothing is available', () => {
    expect(clientIp(req('GET'))).toBe('unknown');
  });
});

describe('assertSameOrigin', () => {
  it('no-ops on safe methods', () => {
    expect(() => assertSameOrigin(req('GET'))).not.toThrow();
    expect(() => assertSameOrigin(req('HEAD'))).not.toThrow();
  });

  it('accepts POST from an allowed origin', () => {
    const r = req('POST', {
      origin: 'http://localhost:4321',
      'content-type': 'application/json',
    });
    expect(() => assertSameOrigin(r)).not.toThrow();
  });

  it('rejects POST from a disallowed origin', () => {
    const r = req('POST', {
      origin: 'https://evil.example',
      'content-type': 'application/json',
    });
    expect(() => assertSameOrigin(r)).toThrow(AppError);
  });

  it('rejects POST with missing Origin + no Referer', () => {
    const r = req('POST', { 'content-type': 'application/json' });
    expect(() => assertSameOrigin(r)).toThrow(/Missing Origin/);
  });

  it('derives origin from Referer when Origin is missing', () => {
    const r = req('POST', {
      referer: 'http://localhost:4321/some/page',
      'content-type': 'application/json',
    });
    expect(() => assertSameOrigin(r)).not.toThrow();
  });

  it('rejects form-encoded bodies (CSRF vector)', () => {
    const r = req('POST', {
      origin: 'http://localhost:4321',
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(() => assertSameOrigin(r)).toThrow(/Unsupported content type/);
  });

  it('rejects multipart/form-data bodies', () => {
    const r = req('POST', {
      origin: 'http://localhost:4321',
      'content-type': 'multipart/form-data; boundary=abc',
    });
    expect(() => assertSameOrigin(r)).toThrow(/Unsupported content type/);
  });
});

describe('newRequestId', () => {
  it('returns a URL-safe short id', () => {
    const id = newRequestId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });
});
