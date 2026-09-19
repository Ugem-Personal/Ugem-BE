import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../config/prisma.js";
import { getMerchantCampaignPerformance } from "./merchant-dashboard.service.js";

describe("Phase 6 campaign analytics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("counts Valid acquisition events without requiring Orders or Payments", async () => {
    vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue({
      id: "merchant-1",
      name: "Merchant",
    } as any);
    vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
      {
        id: "campaign-1",
        name: "Visit campaign",
        description: null,
        discountType: "FixedAmount",
        discountValue: 10000,
        minimumOrderAmount: 0,
        maximumDiscount: null,
        startAt: new Date("2026-09-01T00:00:00.000Z"),
        endAt: new Date("2026-09-30T00:00:00.000Z"),
        usageLimit: null,
        usedCount: 0,
        verifiedVisitLimit: 10,
        maxVerifiedVisitsPerCustomer: 1,
        isActive: true,
        orders: [],
        acquisitionEvents: [
          { id: "event-1", customerId: "customer-1", occurredAt: new Date(), verificationMethod: "DirectQr" },
          { id: "event-2", customerId: "customer-2", occurredAt: new Date(), verificationMethod: "DirectQr" },
          { id: "event-3", customerId: "customer-1", occurredAt: new Date(), verificationMethod: "CustomerCode" },
        ],
      },
    ] as any);
    vi.spyOn(prisma.monetizationFeePolicy, "findFirst").mockResolvedValue({
      amount: 5000,
      currency: "VND",
    } as any);

    const result = await getMerchantCampaignPerformance("merchant-1", 10);
    const campaign = result.items[0];

    expect(campaign).toEqual(
      expect.objectContaining({
        verifiedVisits: 3,
        uniqueVisitors: 2,
        repeatVisits: 1,
        remainingVerifiedVisits: 7,
        totalOrders: 0,
        totalRevenue: 0,
        billingPreview: expect.objectContaining({
          billableVerifiedVisits: 3,
          estimatedAmount: 15000,
          isEstimate: true,
        }),
      }),
    );
  });
});
