import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'file:./data/pomelo.db';
// drizzle-kit expects a raw filesystem path, strip the `file:` prefix if present
const dbPath = url.replace(/^file:/, '');

export default {
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: dbPath },
  strict: true,
  verbose: true,
} satisfies Config;
