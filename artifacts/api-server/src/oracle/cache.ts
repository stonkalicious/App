type CacheEntry<T> = { value: T; freshUntil: number; staleUntil: number };

export class StaleCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number, private readonly staleTtlMs: number) {}

  get(key: string): { value: T; stale: boolean } | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = Date.now();
    if (now > entry.staleUntil) {
      this.entries.delete(key);
      return undefined;
    }
    return { value: entry.value, stale: now > entry.freshUntil };
  }

  set(key: string, value: T): void {
    const now = Date.now();
    this.entries.set(key, { value, freshUntil: now + this.ttlMs, staleUntil: now + this.staleTtlMs });
  }
}