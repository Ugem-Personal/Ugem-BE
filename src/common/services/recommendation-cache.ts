type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class RecommendationCacheService {
  private cache = new Map<string, CacheEntry<any>>();

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public invalidateCustomer(customerId: string): void {
    const customerToken = `"customerId":"${customerId}"`;

    for (const key of this.cache.keys()) {
      if (key.startsWith("recommendation:") && key.includes(customerToken)) {
        this.cache.delete(key);
      }
    }
  }
}

export const recommendationCache = new RecommendationCacheService();
