import { describe, expect, it, beforeEach } from "vitest";
import { recommendationCache } from "../../common/services/recommendation-cache.js";

describe("Order Idempotency Cache", () => {
  const customerId = "cust-123";
  const idempotencyKey = "uuid-key-456";
  const cacheKey = `idempotency:order:${customerId}:${idempotencyKey}`;

  beforeEach(async () => {
    await recommendationCache.del(cacheKey);
  });

  it("caches and retrieves created order response for duplicate requests", async () => {
    const mockOrderResponse = {
      orderId: "order-999",
      code: "ORD-999",
      finalPrice: 120000,
      status: "Pending",
    };

    // First request saves order
    await recommendationCache.set(cacheKey, mockOrderResponse, 300);

    // Subsequent duplicate request retrieves cached result
    const cached = await recommendationCache.get<typeof mockOrderResponse>(cacheKey);
    expect(cached).toBeDefined();
    expect(cached?.orderId).toBe("order-999");
    expect(cached?.finalPrice).toBe(120000);
  });

  it("returns null when no idempotency key was previously saved", async () => {
    const cached = await recommendationCache.get(`idempotency:order:${customerId}:unknown-key`);
    expect(cached).toBeNull();
  });
});
