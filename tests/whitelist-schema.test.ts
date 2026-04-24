import { describe, it, expect } from 'vitest';
import { WhitelistIdSchema, WhitelistInputSchema } from '../src/server/schemas/whitelist';

const valid = {
  minecraftUsername: 'Steve',
  discordHandle: 'steve',
  age: 20,
  whyJoin: 'I want to join this server to build cool things with friends.',
};

describe('WhitelistInputSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(WhitelistInputSchema.parse(valid)).toMatchObject(valid);
  });

  it('normalises Discord handle to lowercase', () => {
    const r = WhitelistInputSchema.parse({ ...valid, discordHandle: 'Pomelo.Smp' });
    expect(r.discordHandle).toBe('pomelo.smp');
  });

  it('rejects MC usernames with illegal chars', () => {
    expect(() =>
      WhitelistInputSchema.parse({ ...valid, minecraftUsername: 'bad name!' }),
    ).toThrow();
  });

  it('rejects MC usernames shorter than 3 or longer than 16', () => {
    expect(() => WhitelistInputSchema.parse({ ...valid, minecraftUsername: 'ab' })).toThrow();
    expect(() =>
      WhitelistInputSchema.parse({ ...valid, minecraftUsername: 'a'.repeat(17) }),
    ).toThrow();
  });

  it('rejects age < 10 and > 99', () => {
    expect(() => WhitelistInputSchema.parse({ ...valid, age: 5 })).toThrow();
    expect(() => WhitelistInputSchema.parse({ ...valid, age: 120 })).toThrow();
  });

  it('rejects whyJoin shorter than 20 chars', () => {
    expect(() => WhitelistInputSchema.parse({ ...valid, whyJoin: 'too short' })).toThrow();
  });

  it('honeypot field must be empty — bot-filled value rejected', () => {
    expect(() =>
      WhitelistInputSchema.parse({ ...valid, website: 'https://spam.example' }),
    ).toThrow();
  });

  it('empty referrer is treated as undefined', () => {
    const r = WhitelistInputSchema.parse({ ...valid, referrer: '' });
    expect(r.referrer).toBeUndefined();
  });
});

describe('WhitelistIdSchema', () => {
  it('accepts URL-safe 20-32 char tokens', () => {
    expect(WhitelistIdSchema.parse('Aw_vKEAgGwUTrvfAgICG9ftX')).toBe('Aw_vKEAgGwUTrvfAgICG9ftX');
  });

  it('rejects ids with illegal chars', () => {
    expect(() => WhitelistIdSchema.parse('abc def ghi jkl mno pqr')).toThrow();
  });

  it('rejects ids that are too short', () => {
    expect(() => WhitelistIdSchema.parse('short')).toThrow();
  });
});
