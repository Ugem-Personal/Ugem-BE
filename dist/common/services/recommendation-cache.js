class RecommendationCacheService {
    cache = new Map();
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    set(key, data, ttlMs = 30 * 60 * 1000) {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }
    clear() {
        this.cache.clear();
    }
    invalidate(key) {
        this.cache.delete(key);
    }
    invalidateCustomer(customerId) {
        const customerToken = `"customerId":"${customerId}"`;
        for (const key of this.cache.keys()) {
            if (key.startsWith("recommendation:") && key.includes(customerToken)) {
                this.cache.delete(key);
            }
        }
    }
}
export const recommendationCache = new RecommendationCacheService();
