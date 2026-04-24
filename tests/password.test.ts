import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/server/lib/password';

describe('password', () => {
  it('hash → verify round-trip returns true', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('wrong password returns false (not throw)', async () => {
    const hash = await hashPassword('one-password');
    expect(await verifyPassword('another-password', hash)).toBe(false);
  });

  it('hashes are unique per call (random salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same-input'), hashPassword('same-input')]);
    expect(a).not.toBe(b);
  });

  it('rejects passwords shorter than 8 chars', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 8/);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('p', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('p', 'scrypt:abc')).toBe(false);
    expect(await verifyPassword('p', 'bcrypt:abc:def')).toBe(false);
  });
});
