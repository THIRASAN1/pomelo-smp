import { describe, it, expect } from 'vitest';
import { fingerprint, hashIp, randomToken, safeEqual } from '../src/server/lib/crypto';

describe('crypto helpers', () => {
  describe('hashIp', () => {
    it('is deterministic for the same IP', () => {
      expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    });

    it('differs across IPs', () => {
      expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
    });

    it('returns a hex string of fixed width', () => {
      const h = hashIp('10.0.0.1');
      expect(h).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('randomToken', () => {
    it('returns URL-safe base64 without padding', () => {
      const t = randomToken(18);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t.endsWith('=')).toBe(false);
    });

    it('produces unique tokens on each call', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) seen.add(randomToken(18));
      expect(seen.size).toBe(100);
    });
  });

  describe('safeEqual', () => {
    it('true for equal strings', () => {
      expect(safeEqual('secret', 'secret')).toBe(true);
    });
    it('false for unequal strings', () => {
      expect(safeEqual('secret', 'Secret')).toBe(false);
    });
    it('false for different lengths', () => {
      expect(safeEqual('a', 'aa')).toBe(false);
    });
  });

  describe('fingerprint', () => {
    it('returns a short 10-char hex', () => {
      expect(fingerprint('hello world')).toMatch(/^[0-9a-f]{10}$/);
    });
  });
});
