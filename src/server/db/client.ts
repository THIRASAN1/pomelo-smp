import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env, isDev } from '../env';
import { logger } from '../lib/logger';
import * as schema from './schema';

/**
 * libsql client — SQLite-compatible, with prebuilt native bindings for Windows/Linux/macOS
 * (no node-gyp / VS Build Tools required). Swap `url` to a Turso URL to move to hosted.
 */
const dbPath = env.DATABASE_URL.replace(/^file:/, '');
const dir = dirname(dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const sqlite: Client = createClient({
  url: env.DATABASE_URL.startsWith('file:') ? env.DATABASE_URL : `file:${dbPath}`,
});

// Best-practice pragmas for durability + speed. libsql accepts standard SQLite PRAGMAs.
await sqlite.executeMultiple(
  [
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA temp_store = MEMORY',
    'PRAGMA foreign_keys = ON',
    'PRAGMA busy_timeout = 5000',
  ].join(';'),
);

logger.debug({ dbPath }, 'libsql connected');

export const db = drizzle(sqlite, { schema, logger: isDev });

// Graceful shutdown — close the DB when the process exits.
const shutdown = () => {
  try {
    sqlite.close();
    logger.info('libsql closed');
  } catch (e) {
    logger.error({ err: e }, 'libsql close failed');
  }
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.once('beforeExit', shutdown);
