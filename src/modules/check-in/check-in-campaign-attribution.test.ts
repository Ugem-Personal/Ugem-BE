import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { verifyCheckIn } from "./check-in.service.js";

const merchant = {
  id: "merchant-1",
  userId: "merchant-user",
  name: "Merchant",
  logoUrl: null,
  latitude: 10.7769,
  longitude: 106.7009,
  status: "Active",
};

const customer = {
  id: "customer-1",
  userId: "customer-user",
};

const createToken = (campaignId?: string) =>
  jwt.sign(
    {
      type: "DirectVisit",
      merchantId: merchant.id,
      campaignId: campaignId ?? null,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );

const setup = (options: {
  campaign?: Record<string, unknown> | null;
  eventCounts?: number[];
  serializationFailures?: number;
} = {}) => {
  const checkInCreate = vi.fn().mockResolvedValue({ id: "check-in-1" });
  const acquisitionCreate = vi.fn().mockResolvedValue({});
  const eventCount = vi
    .fn()
    .mockImplementation(async () => options.eventCounts?.shift() ?? 0);
  let transactionAttempts = 0;

  vi.spyOn(prisma.customer, "findUnique").mockResolvedValue(customer as any);
  vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue(merchant as any);
  vi.spyOn(prisma.checkIn, "count").mockResolvedValue(0);
  vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(null);
  vi.spyOn(prisma.campaign, "findFirst").mockResolvedValue(
    (options.campaign ?? null) as any,
  );
  vi.spyOn(prisma.merchantAcquisitionEvent, "count").mockImplementation(
    eventCount as any,
  );
  vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);
  vi.spyOn(prisma, "$transaction").mockImplementation(
    async (operation: any) => {
      transactionAttempts++;
      if (transactionAttempts <= (options.serializationFailures ?? 0)) {
        const error: any = new Error("serialization conflict");
        error.code = "P2034";
        throw error;
      }

      return operation({
        campaign: {
          findFirst: vi.fn().mockResolvedValue(options.campaign ?? null),
        },
        checkIn: { create: checkInCreate },
        merchantAcquisitionEvent: {
          count: eventCount,
          create: acquisitionCreate,
        },
        customer: { update: vi.fn().mockResolvedValue({ gemPoints: 10 }) },
        reviewerPointTransaction: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
      }) as any;
    },
  );

  return {
    checkInCreate,
    acquisitionCreate,
    transactionAttempts: () => transactionAttempts,
  };
};

describe("Phase 6 campaign to Verified Visit attribution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("attributes an eligible campaign to the CheckIn and acquisition event", async () => {
    const { checkInCreate, acquisitionCreate } = setup({
      campaign: {
        id: "campaign-1",
        verifiedVisitLimit: 10,
        maxVerifiedVisitsPerCustomer: 1,
      },
      eventCounts: [3, 0],
    });

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      createToken("campaign-1"),
      10.7771,
      106.701,
    );

    expect(result.status).toBe("Verified");
    expect(result.campaignId).toBe("campaign-1");
    expect(checkInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "campaign-1",
          source: "Campaign",
        }),
      }),
    );
    expect(acquisitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "campaign-1",
          source: "Campaign",
        }),
      }),
    );
  });

  it("retries a serialization conflict and re-checks campaign attribution", async () => {
    const { checkInCreate, transactionAttempts } = setup({
      campaign: {
        id: "campaign-1",
        verifiedVisitLimit: 10,
        maxVerifiedVisitsPerCustomer: 1,
      },
      eventCounts: [3, 0],
      serializationFailures: 1,
    });

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      createToken("campaign-1"),
      10.7771,
      106.701,
    );

    expect(transactionAttempts()).toBe(2);
    expect(result.campaignId).toBe("campaign-1");
    expect(checkInCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps a non-campaign visit as DirectVisit", async () => {
    const { checkInCreate, acquisitionCreate } = setup();

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      createToken(),
      10.7771,
      106.701,
    );

    expect(result.status).toBe("Verified");
    expect(result.campaignId).toBeNull();
    expect(checkInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: null,
          source: "DirectVisit",
        }),
      }),
    );
    expect(acquisitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: null,
          source: "DirectVisit",
        }),
      }),
    );
  });

  it.each([
    ["expired", null, []],
    ["disabled", null, []],
    ["visit quota reached", {
      id: "campaign-1",
      verifiedVisitLimit: 10,
      maxVerifiedVisitsPerCustomer: 1,
    }, [10]],
    ["customer quota reached", {
      id: "campaign-1",
      verifiedVisitLimit: null,
      maxVerifiedVisitsPerCustomer: 1,
    }, [1]],
  ])("falls back to DirectVisit when campaign is %s", async (_label, campaign, eventCounts) => {
    const { checkInCreate, acquisitionCreate } = setup({
      campaign: campaign as Record<string, unknown> | null,
      eventCounts: [...(eventCounts as number[])],
    });

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      createToken("campaign-1"),
      10.7771,
      106.701,
    );

    expect(result.status).toBe("Verified");
    expect(result.campaignId).toBeNull();
    expect(checkInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ campaignId: null, source: "DirectVisit" }),
      }),
    );
    expect(acquisitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ campaignId: null, source: "DirectVisit" }),
      }),
    );
  });
});
