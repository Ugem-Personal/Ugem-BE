import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../config/prisma.js";
import { getMerchantAnalytics } from "../../../common/services/merchant-analytics.service.js";

describe("Merchant Analytics and PPVV preview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates valid acquisition events, source splits and estimated PPVV", async () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-30T23:59:59.999Z");

    vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue({
      id: "merchant-1",
      name: "Merchant",
    } as any);
    const acquisitionFindMany = vi
      .spyOn(prisma.merchantAcquisitionEvent, "findMany")
      .mockResolvedValue([
        { customerId: "customer-1", campaignId: "campaign-1", source: "Campaign", occurredAt: from },
        { customerId: "customer-1", campaignId: null, source: "Recommendation", occurredAt: from },
        { customerId: "customer-2", campaignId: null, source: "DirectVisit", occurredAt: to },
      ] as any);
    const viewGroupBy = vi.spyOn(prisma.merchantView, "groupBy").mockResolvedValue([
      { source: "Recommendation", _count: { _all: 4 } },
      { source: "Sponsored", _count: { _all: 2 } },
      { source: "Direct", _count: { _all: 1 } },
    ] as any);
    const wishlistCount = vi.spyOn(prisma.wishlist, "count").mockResolvedValue(6);
    const reviewCount = vi.spyOn(prisma.review, "count").mockResolvedValue(1);
    vi.spyOn(prisma.monetizationFeePolicy, "findFirst").mockResolvedValue({
      amount: 5000,
      currency: "VND",
    } as any);

    const result = await getMerchantAnalytics("merchant-1", { from, to });

    expect(result?.visits).toMatchObject({
      verifiedVisits: 3,
      uniqueVisitors: 2,
      repeatVisitors: 1,
      repeatVisits: 1,
      campaignVerifiedVisits: 1,
      nonCampaignVerifiedVisits: 2,
    });
    expect(result?.traffic).toMatchObject({
      totalViews: 7,
      organicViews: 5,
      sponsoredViews: 2,
      saves: 6,
    });
    expect(result?.billingPreview).toMatchObject({
      billableVerifiedVisits: 1,
      feePerVerifiedVisit: 5000,
      estimatedAmount: 5000,
      currency: "VND",
      isEstimate: true,
      billingStatus: "PreviewOnly",
    });
    expect(result?.conversion.visitConversionRate).toBe(42.86);
    expect(result?.conversion.sponsoredConversionRate).toBe(50);
    expect(result?.reviews.reviewConversionRate).toBe(33.33);
    expect(result?.acquisition.bySource).toEqual({
      Campaign: 1,
      Recommendation: 1,
      DirectVisit: 1,
    });
    expect(acquisitionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          merchantId: "merchant-1",
          status: "Valid",
          occurredAt: { gte: from, lte: to },
        }),
      }),
    );
    expect(viewGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: "merchant-1", createdAt: { gte: from, lte: to } },
      }),
    );
    expect(wishlistCount).toHaveBeenCalledWith({
      where: { merchantId: "merchant-1", createdAt: { gte: from, lte: to } },
    });
    expect(reviewCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          merchantId: "merchant-1",
          checkInId: { not: null },
          createdAt: { gte: from, lte: to },
        }),
      }),
    );
  });

  it("returns zero conversion rates when there are no views", async () => {
    vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue({
      id: "merchant-1",
      name: "Merchant",
    } as any);
    vi.spyOn(prisma.merchantAcquisitionEvent, "findMany").mockResolvedValue([
      { customerId: "customer-1", campaignId: "campaign-1", source: "Campaign" },
    ] as any);
    vi.spyOn(prisma.merchantView, "groupBy").mockResolvedValue([]);
    vi.spyOn(prisma.wishlist, "count").mockResolvedValue(0);
    vi.spyOn(prisma.review, "count").mockResolvedValue(0);
    vi.spyOn(prisma.monetizationFeePolicy, "findFirst").mockResolvedValue(null);

    const result = await getMerchantAnalytics("merchant-1");

    expect(result?.conversion).toEqual({
      visitConversionRate: 0,
      sponsoredConversionRate: 0,
      nonCampaignConversionRate: 0,
    });
  });
});
