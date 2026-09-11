import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../utils/logger.js";
class RecommendationCacheService {
    memoryCache = new Map();
    redis = null;
    isRedisConnected = false;
    constructor() {
        this.initRedis();
    }
    initRedis() {
        const redisUrl = env.REDIS_URL || process.env.REDIS_URL;
        if (!redisUrl) {
            logger.info("cache.using_in_memory_mode");
            return;
        }
        try {
            this.redis = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 2,
                enableOfflineQueue: false,
                retryStrategy: (times) => {
                    if (times > 3)
                        return null;
                    return Math.min(times * 1000, 3000);
                },
            });
            this.redis.on("connect", () => {
                this.isRedisConnected = true;
                logger.info("cache.redis_connected");
            });
            this.redis.on("error", (err) => {
                this.isRedisConnected = false;
                logger.warn("cache.redis_error_fallback_to_memory", { error: err.message });
            });
            this.redis.on("close", () => {
                this.isRedisConnected = false;
            });
            this.redis.connect().catch((err) => {
                logger.warn("cache.redis_connect_failed_fallback_to_memory", {
                    error: err.message,
                });
            });
        }
        catch (err) {
            logger.warn("cache.redis_init_failed", { error: err });
        }
    }
    get(key) {
        // 1. Fast in-memory lookup
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (Date.now() > entry.expiresAt) {
                this.memoryCache.delete(key);
                return null;
            }
            return entry.data;
        }
        return null;
    }
    async getAsync(key) {
        const memoryHit = this.get(key);
        if (memoryHit !== null)
            return memoryHit;
        if (this.redis && this.isRedisConnected) {
            try {
                const raw = await this.redis.get(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    // Populate fast memory cache
                    this.memoryCache.set(key, {
                        data: parsed,
                        expiresAt: Date.now() + 60_000, // short local warm cache
                    });
                    return parsed;
                }
            }
            catch (err) {
                logger.warn("cache.redis_get_failed", { key, error: err });
            }
        }
        return null;
    }
    set(key, data, ttlMs = 30 * 60 * 1000) {
        // 1. Set in-memory cache
        this.memoryCache.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
        // 2. Set in Redis asynchronously
        if (this.redis && this.isRedisConnected) {
            const ttlSec = Math.max(1, Math.round(ttlMs / 1000));
            this.redis.set(key, JSON.stringify(data), "EX", ttlSec).catch((err) => {
                logger.warn("cache.redis_set_failed", { key, error: err });
            });
        }
    }
    del(key) {
        this.delete(key);
    }
    delete(key) {
        this.memoryCache.delete(key);
        if (this.redis && this.isRedisConnected) {
            this.redis.del(key).catch((err) => {
                logger.warn("cache.redis_del_failed", { key, error: err });
            });
        }
    }
    clear() {
        this.memoryCache.clear();
        if (this.redis && this.isRedisConnected) {
            this.redis.flushdb().catch((err) => {
                logger.warn("cache.redis_flush_failed", { error: err });
            });
        }
    }
    invalidate(key) {
        this.memoryCache.delete(key);
        if (this.redis && this.isRedisConnected) {
            this.redis.del(key).catch((err) => {
                logger.warn("cache.redis_del_failed", { key, error: err });
            });
        }
    }
    invalidateCustomer(customerId) {
        const customerToken = `"customerId":"${customerId}"`;
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith("recommendation:") && key.includes(customerToken)) {
                this.memoryCache.delete(key);
            }
        }
        if (this.redis && this.isRedisConnected) {
            // Find matching keys in Redis via SCAN pattern
            this.redis.keys(`recommendation:*${customerToken}*`).then((keys) => {
                if (keys && keys.length > 0) {
                    this.redis?.del(...keys).catch(() => { });
                }
            }).catch(() => { });
        }
    }
}
export const recommendationCache = new RecommendationCacheService();
