import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../utils/logger.js";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class RecommendationCacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private redis: Redis | null = null;
  private isRedisConnected = false;

  constructor() {
    this.initRedis();
  }

  private initRedis() {
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
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        },
      });

      this.redis.on("connect", () => {
        this.isRedisConnected = true;
        logger.info("cache.redis_connected");
      });

      this.redis.on("error", (err: Error) => {
        this.isRedisConnected = false;
        logger.warn("cache.redis_error_fallback_to_memory", { error: err.message });
      });

      this.redis.on("close", () => {
        this.isRedisConnected = false;
      });

      this.redis.connect().catch((err: Error) => {
        logger.warn("cache.redis_connect_failed_fallback_to_memory", {
          error: err.message,
        });
      });
    } catch (err: unknown) {
      logger.warn("cache.redis_init_failed", { error: err });
    }
  }

  public get<T>(key: string): T | null {
    // 1. Fast in-memory lookup
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.memoryCache.delete(key);
        return null;
      }
      return entry.data as T;
    }

    return null;
  }

  public async getAsync<T>(key: string): Promise<T | null> {
    const memoryHit = this.get<T>(key);
    if (memoryHit !== null) return memoryHit;

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
          return parsed as T;
        }
      } catch (err: unknown) {
        logger.warn("cache.redis_get_failed", { key, error: err });
      }
    }

    return null;
  }

  public set<T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void {
    // 1. Set in-memory cache
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });

    // 2. Set in Redis asynchronously
    if (this.redis && this.isRedisConnected) {
      const ttlSec = Math.max(1, Math.round(ttlMs / 1000));
      this.redis.set(key, JSON.stringify(data), "EX", ttlSec).catch((err: Error) => {
        logger.warn("cache.redis_set_failed", { key, error: err });
      });
    }
  }

  public del(key: string): void {
    this.delete(key);
  }

  public delete(key: string): void {
    this.memoryCache.delete(key);
    if (this.redis && this.isRedisConnected) {
      this.redis.del(key).catch((err: Error) => {
        logger.warn("cache.redis_del_failed", { key, error: err });
      });
    }
  }

  public clear(): void {
    this.memoryCache.clear();

    if (this.redis && this.isRedisConnected) {
      this.redis.flushdb().catch((err: Error) => {
        logger.warn("cache.redis_flush_failed", { error: err });
      });
    }
  }

  public invalidate(key: string): void {
    this.memoryCache.delete(key);

    if (this.redis && this.isRedisConnected) {
      this.redis.del(key).catch((err: Error) => {
        logger.warn("cache.redis_del_failed", { key, error: err });
      });
    }
  }

  public invalidateCustomer(customerId: string): void {
    const customerToken = `"customerId":"${customerId}"`;

    for (const key of this.memoryCache.keys()) {
      if (key.startsWith("recommendation:") && key.includes(customerToken)) {
        this.memoryCache.delete(key);
      }
    }

    if (this.redis && this.isRedisConnected) {
      // Find matching keys in Redis via SCAN pattern
      this.redis.keys(`recommendation:*${customerToken}*`).then((keys: string[]) => {
        if (keys && keys.length > 0) {
          this.redis?.del(...keys).catch(() => {});
        }
      }).catch(() => {});
    }
  }
}

export const recommendationCache = new RecommendationCacheService();
