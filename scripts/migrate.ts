/**
 * Run Drizzle migrations against the configured libsql / SQLite database.
 * Usage: `npm run db:migrate`
 *
 * Env vars are loaded by Node's native `--env-file` flag (see package.json script).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./data/pomelo.db';
const dbPath = url.replace(/^file:/, '');
const dir = dirname(dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const sqlite = createClient({ url: url.startsWith('file:') ? url : `file:${dbPath}` });
await sqlite.executeMultiple(['PRAGMA journal_mode = WAL', 'PRAGMA foreign_keys = ON'].join(';'));

const db = drizzle(sqlite);

const started = Date.now();
await migrate(db, { migrationsFolder: './drizzle' });
const ms = Date.now() - started;

console.log(`✔ migrations applied in ${ms}ms → ${dbPath}`);
sqlite.close();
