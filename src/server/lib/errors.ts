import { ZodError } from 'zod';

/**
 * Error taxonomy used across the API layer. Each error maps 1:1 to an HTTP status.
 * The `code` field is a stable machine-readable identifier the client can key off.
 */
export type ErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'conflict'
  | 'upstream_error'
  | 'internal_error';

const statusByCode: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  upstream_error: 502,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean; // expose message to clients?

  constructor(code: ErrorCode, message: string, opts?: { details?: unknown; expose?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = statusByCode[code];
    this.details = opts?.details;
    this.expose = opts?.expose ?? true;
  }
}

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

/** Convert any thrown value into a safe JSON Response. */
export function toErrorResponse(err: unknown, requestId?: string): Response {
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'validation_failed',
        message: 'Invalid request payload',
        details: err.issues.map((i) => ({ path: i.path, message: i.message, code: i.code })),
        requestId,
      },
    };
    return json(body, 422);
  }

  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Request failed',
        details: err.expose ? err.details : undefined,
        requestId,
      },
    };
    return json(body, err.status);
  }

  // unknown error — never leak stack traces or messages to clients
  const body: ErrorBody = {
    error: { code: 'internal_error', message: 'Internal server error', requestId },
  };
  return json(body, 500);
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}
