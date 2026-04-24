/**
 * Small CLI to turn a plaintext password into the scrypt hash string
 * expected by ADMIN_PASSWORD_HASH.
 *
 * Usage: `npm run admin:hash -- "your-strong-password"`
 *
 * Do NOT commit the output. Paste it into `.env`.
 */
import { hashPassword } from '../src/server/lib/password';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run admin:hash -- "<password>"');
  process.exit(2);
}

const started = Date.now();
const hash = await hashPassword(arg);
const took = Date.now() - started;

console.log('\n✔ ADMIN_PASSWORD_HASH (copy into .env):\n');
console.log(hash);
console.log(`\n(generated in ${took}ms)\n`);
