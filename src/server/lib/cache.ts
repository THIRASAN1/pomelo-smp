/**
 * Minimal dependency-free TTL cache with single-flight de-duplication.
 * Good enough for caching upstream API calls (e.g. mcsrvstat.us) at in-process scale.
 *
 * - `get` returns the cached value if fresh, else runs the loader once.
 * - Concurrent callers during a miss share the same in-flight promise — prevents
 *   "thundering herd" requests to upstream.
 */
type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  peek(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  async get(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    const fresh = this.peek(key);
    if (fresh !== undefined) return fresh;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const p = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, p);
    return p;
  }
}
