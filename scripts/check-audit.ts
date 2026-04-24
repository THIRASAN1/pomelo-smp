/**
 * One-off inspection script: print the most recent audit_log rows.
 * Usage: npm run admin:hash -- (reuse tsx) ... here we call it directly.
 */
import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL ?? 'file:./data/pomelo.db';
const client = createClient({ url });

const res = await client.execute(
  `SELECT id, actor, action, subject_type, subject_id,
          substr(metadata, 1, 120) as metadata,
          datetime(created_at / 1000, 'unixepoch') as created
   FROM audit_log
   ORDER BY created_at DESC
   LIMIT 10`,
);

console.log(`\n${res.rows.length} audit rows (most recent first):\n`);
for (const r of res.rows) {
  console.log(`  [${r.created}] ${r.actor} · ${r.action} · ${r.subject_id ?? '-'}`);
  if (r.metadata) console.log(`    ${r.metadata}`);
}

client.close();
