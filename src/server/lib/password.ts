import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt-based password hashing. Pure Node built-in — no native deps.
 *
 * Format:  `scrypt:<salt_hex>:<hash_hex>`
 *   - salt:  16 bytes  (32 hex chars)
 *   - hash:  64 bytes  (128 hex chars)
 *
 * N=2^15 / r=8 / p=1 is the OWASP-recommended baseline and takes ~50–100 ms
 * on a modern CPU — slow enough to deter offline attacks, fast enough for
 * interactive logins.
 */
const KEYLEN = 64;
const SCRYPT_OPTS: ScryptOptions = {
  N: 1 << 15,
  r: 8,
  p: 1,
  // Node's default maxmem is 32 MB — too small for N=2^15. Bump to 64 MB.
  maxmem: 64 * 1024 * 1024,
};

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT_OPTS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  if (expected.length !== KEYLEN) return false;

  const actual = await scrypt(password, salt, KEYLEN, SCRYPT_OPTS);
  return timingSafeEqual(actual, expected);
}
