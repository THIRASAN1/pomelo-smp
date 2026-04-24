import { describe, it, expect, vi } from 'vitest';
import { TtlCache } from '../src/server/lib/cache';

describe('TtlCache', () => {
  it('caches values within TTL', async () => {
    const c = new TtlCache<number>(10_000);
    let calls = 0;
    const loader = vi.fn(async () => ++calls);

    expect(await c.get('k', loader)).toBe(1);
    expect(await c.get('k', loader)).toBe(1);
    expect(await c.get('k', loader)).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('expires values after TTL', async () => {
    const c = new TtlCache<number>(10);
    let calls = 0;

    await c.get('k', async () => ++calls);
    await new Promise((r) => setTimeout(r, 20));
    await c.get('k', async () => ++calls);
    expect(calls).toBe(2);
  });

  it('peek returns undefined after expiry', async () => {
    const c = new TtlCache<string>(10);
    c.set('k', 'v');
    expect(c.peek('k')).toBe('v');
    await new Promise((r) => setTimeout(r, 20));
    expect(c.peek('k')).toBeUndefined();
  });

  it('single-flight: 10 concurrent misses fire the loader once', async () => {
    const c = new TtlCache<number>(10_000);
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      return 42;
    };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => c.get('k', loader)),
    );
    expect(results.every((r) => r === 42)).toBe(true);
    expect(calls).toBe(1);
  });

  it('delete removes a key', () => {
    const c = new TtlCache<string>(10_000);
    c.set('k', 'v');
    c.delete('k');
    expect(c.peek('k')).toBeUndefined();
  });
});
