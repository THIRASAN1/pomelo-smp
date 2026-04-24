import pino, { type Logger } from 'pino';
import { env, isDev } from '../env';

/**
 * Structured JSON logger. In development we pretty-print for readability,
 * in production we emit JSON to stdout so log aggregators can parse it.
 */
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'pomelo-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // never leak secrets or PII into logs
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'APP_SECRET',
      '*.password',
      '*.token',
      'DISCORD_WEBHOOK_URL',
    ],
    remove: true,
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          singleLine: true,
          ignore: 'pid,hostname,service',
        },
      }
    : undefined,
});
