import { beforeEach, describe, expect, it } from "vitest";

import { recommendationCache } from "./recommendation-cache.js";

describe("recommendationCache.invalidateCustomer", () => {
  beforeEach(() => recommendationCache.clear());

  it("removes only recommendation entries for the updated customer", () => {
    const firstCustomerKey =
      'recommendation:{"customerId":"customer-1","pageIndex":1}';
    const secondCustomerKey =
      'recommendation:{"customerId":"customer-2","pageIndex":1}';

    recommendationCache.set(firstCustomerKey, ["old"]);
    recommendationCache.set(secondCustomerKey, ["keep"]);

    recommendationCache.invalidateCustomer("customer-1");

    expect(recommendationCache.get(firstCustomerKey)).toBeNull();
    expect(recommendationCache.get(secondCustomerKey)).toEqual(["keep"]);
  });
});
