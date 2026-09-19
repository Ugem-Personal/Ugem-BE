import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../config/prisma.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";
import { getMerchants } from "./merchant.service.js";
import {
  merchantListSchema,
  merchantViewSchema,
} from "./merchant.schema.js";

const yesterday = new Date("2026-09-17T12:00:00.000Z");
const tomorrow = new Date("2026-09-19T12:00:00.000Z");

const baseMerchant = {
  id: "merchant-1",
  userId: "merchant-user-1",
  name: "Merchant One",
  description: "A test restaurant",
  restaurantType: "Vietnamese",
  mainDishType: "Noodles",
  priceRange: "$$",
  email: "merchant@example.com",
  phone: "0900000000",
  address: "1 Test Street",
  openingHours: "08:00-22:00",
  latitude: 10.7769,
  longitude: 106.7009,
  logoUrl: null,
  bankCode: null,
  bankAccountNumber: null,
  bankAccountName: null,
  bankTransferEnabled: false,
  rating: 4,
  reviewCount: 10,
  totalViews: 20,
  underratedScore: 0.2,
  strengthIndex: 1,
  recommendationRank: null,
  gemStatus: null,
  status: "Active",
  listingVisibility: "Public",
  safetySuppressed: false,
  createdAt: yesterday,
  updatedAt: yesterday,
  _count: { checkIns: 5 },
  foods: [],
  campaigns: [],
};

const activeCampaign = {
  id: "campaign-1",
  merchantId: "merchant-1",
  name: "Sponsored discount",
  description: "A sponsored campaign",
  code: "SAVE20",
  discountType: "Percentage",
  discountValue: 20,
  startAt: yesterday,
  endAt: tomorrow,
  usageLimit: null,
  usedCount: 0,
  verifiedVisitLimit: 200,
  acquisitionEvents: Array.from({ length: 30 }, (_, index) => ({
    id: `event-${index + 1}`,
  })),
  isActive: true,
  createdAt: yesterday,
  merchant: {
    ...baseMerchant,
    campaigns: [],
  },
};

const organicQuery = {
  pageIndex: 1,
  pageSize: 10,
  discoveryType: "Organic" as const,
};

const sponsoredQuery = {
  pageIndex: 1,
  pageSize: 10,
  discoveryType: "Sponsored" as const,
};

describe("Phase 3 Organic/Sponsored discovery separation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    recommendationCache.clear();
  });

  it("keeps organic score unchanged when a campaign is added", async () => {
    const findMany = vi.spyOn(prisma.merchant, "findMany");
    findMany
      .mockResolvedValueOnce([
        { ...baseMerchant, campaigns: [] },
      ] as any)
      .mockResolvedValueOnce([
        {
          ...baseMerchant,
          campaigns: [
            {
              isActive: true,
              startAt: yesterday,
              endAt: tomorrow,
              usageLimit: null,
              usedCount: 0,
            },
          ],
        },
      ] as any);

    const withoutCampaign = await getMerchants(organicQuery);
    recommendationCache.clear();
    const withCampaign = await getMerchants(organicQuery);

    expect(withoutCampaign.items[0]?.recommendationScore).toBe(
      withCampaign.items[0]?.recommendationScore,
    );
  });

  it("returns Organic and isSponsored false even with an active campaign", async () => {
    vi.spyOn(prisma.merchant, "findMany").mockResolvedValue([
      {
        ...baseMerchant,
        campaigns: [
          {
            isActive: true,
            startAt: yesterday,
            endAt: tomorrow,
            usageLimit: null,
            usedCount: 0,
          },
        ],
      },
    ] as any);

    const result = await getMerchants(organicQuery);
    const item = result.items[0];

    expect(item?.hasActiveCampaign).toBe(true);
    expect(item?.discoveryType).toBe("Organic");
    expect(item?.isSponsored).toBe(false);
  });

  it("returns eligible active campaigns on the Sponsored surface", async () => {
    vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
      activeCampaign,
    ] as any);

    const result = await getMerchants(sponsoredQuery);
    const item = result.items[0];

    expect(result.discoveryType).toBe("Sponsored");
    expect(item?.isSponsored).toBe(true);
    expect(item?.discoveryType).toBe("Sponsored");
    expect(item?.sponsoredCampaign).toEqual(
      expect.objectContaining({
        id: "campaign-1",
        name: "Sponsored discount",
      }),
    );
  });

  it.each([
    ["inactive", { isActive: false }],
    [
      "expired",
      {
        startAt: new Date("2026-09-16T00:00:00.000Z"),
        endAt: yesterday,
      },
    ],
    [
      "future",
      {
        startAt: tomorrow,
        endAt: new Date("2026-09-20T00:00:00.000Z"),
      },
    ],
    [
      "suppressed",
      {
        merchant: { ...activeCampaign.merchant, safetySuppressed: true },
      },
    ],
    [
      "non-public",
      {
        merchant: { ...activeCampaign.merchant, listingVisibility: "Hidden" },
      },
    ],
    [
      "inactive merchant",
      {
        merchant: { ...activeCampaign.merchant, status: "Inactive" },
      },
    ],
  ])("excludes %s Sponsored campaign", async (_label, overrides) => {
    vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
      { ...activeCampaign, ...overrides },
    ] as any);

    const result = await getMerchants(sponsoredQuery);

    expect(result.items).toHaveLength(0);
    expect(result.totalItems).toBe(0);
  });

  it("ignores exhausted legacy Order quota when Verified Visits remain", async () => {
    vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
      {
        ...activeCampaign,
        usageLimit: 100,
        usedCount: 100,
        verifiedVisitLimit: 200,
        acquisitionEvents: Array.from({ length: 30 }, (_, index) => ({
          id: `verified-event-${index + 1}`,
        })),
      },
    ] as any);

    const result = await getMerchants(sponsoredQuery);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.isSponsored).toBe(true);
    expect(result.items[0]?.sponsoredCampaign?.id).toBe("campaign-1");
  });

  it("deduplicates multiple eligible campaigns for one merchant", async () => {
    vi.spyOn(prisma.campaign, "findMany").mockResolvedValue([
      activeCampaign,
      {
        ...activeCampaign,
        id: "campaign-2",
        name: "Another campaign",
        createdAt: tomorrow,
      },
    ] as any);

    const result = await getMerchants(sponsoredQuery);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.merchantId).toBe("merchant-1");
  });

  it("normalizes legacy PascalCase discovery query and defaults to Organic", () => {
    const legacy = merchantListSchema.parse({
      query: {
        DiscoveryType: "Sponsored",
      },
    });
    const defaulted = merchantListSchema.parse({ query: {} });

    expect(legacy.query.discoveryType).toBe("Sponsored");
    expect(defaulted.query.discoveryType).toBe("Organic");
  });

  it("accepts Sponsored as a merchant view source", () => {
    const parsed = merchantViewSchema.parse({
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: { source: "Sponsored" },
    });

    expect(parsed.body.source).toBe("Sponsored");
  });
});
