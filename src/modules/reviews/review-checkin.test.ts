import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../config/prisma.js";
import { createReviewSchema } from "./review.schema.js";
import {
  createReview,
  deleteReview,
  getMyReviews,
  updateReview,
} from "./review.service.js";

const verifiedAt = new Date("2026-09-18T00:00:00.000Z");

const baseCheckIn = {
  id: "check-in-1",
  customerId: "customer-1",
  merchantId: "merchant-1",
  status: "Verified",
  verifiedAt,
  merchant: {
    id: "merchant-1",
    userId: "merchant-user",
    name: "Merchant",
  },
  customer: {
    userId: "customer-user",
  },
};

const makeReview = (overrides: Record<string, unknown> = {}) => ({
  id: "review-1",
  customerId: "customer-1",
  merchantId: "merchant-1",
  checkInId: "check-in-1",
  orderId: null,
  rating: 1,
  content: "Bad",
  imageUrl: null,
  customer: {
    id: "customer-1",
    user: {
      id: "user-1",
      fullName: "Customer",
      avatarUrl: null,
    },
  },
  merchant: {
    id: "merchant-1",
    name: "Merchant",
    logoUrl: null,
  },
  order: null,
  checkIn: {
    id: "check-in-1",
    status: "Verified",
    verifiedAt,
  },
  details: [],
  createdAt: verifiedAt,
  updatedAt: verifiedAt,
  ...overrides,
});

const setupCheckInCreate = (
  createdReview = makeReview(),
  aggregateRating = 1,
) => {
  const reviewCreate = vi.fn().mockResolvedValue(createdReview);
  const aggregate = vi.fn().mockResolvedValue({
    _avg: { rating: aggregateRating },
    _count: { rating: 1 },
  });
  const merchantUpdate = vi.fn().mockResolvedValue({});
  const acquisitionTransaction = {
    review: {
      create: reviewCreate,
      aggregate,
    },
    merchant: {
      update: merchantUpdate,
    },
    customer: {
      update: vi.fn().mockResolvedValue({ gemPoints: 15 }),
    },
    reviewerPointTransaction: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };

  vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);
  vi.spyOn(prisma, "$transaction").mockImplementation(
    async (operation: any) => operation(acquisitionTransaction) as any,
  );

  return { reviewCreate, aggregate, merchantUpdate };
};

describe("Phase 2 CheckIn-based reviews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Verified CheckIn review without an Order", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
      baseCheckIn as any,
    );
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue(null);
    const { reviewCreate } = setupCheckInCreate();

    const result = await createReview("customer-1", {
      checkInId: "check-in-1",
      rating: 1,
      content: "Bad",
    });

    expect(result.orderId).toBeNull();
    expect(result.checkInId).toBe("check-in-1");
    expect(result.isVerifiedDiner).toBe(true);
    expect(reviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: "merchant-1",
          checkInId: "check-in-1",
          orderId: null,
          rating: 1,
        }),
      }),
    );
  });

  it("allows a five-star Verified CheckIn review", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
      baseCheckIn as any,
    );
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue(null);
    setupCheckInCreate(makeReview({ rating: 5 }), 5);

    const result = await createReview("customer-1", {
      checkInId: "check-in-1",
      rating: 5,
    });

    expect(result.rating).toBe(5);
    expect(result.isVerifiedDiner).toBe(true);
  });

  it("rejects another customer's CheckIn", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue({
      ...baseCheckIn,
      customerId: "other-customer",
    } as any);

    await expect(
      createReview("customer-1", {
        checkInId: "check-in-1",
        rating: 3,
      }),
    ).rejects.toThrow("Check-in không thuộc Customer");
  });

  it("rejects a non-verified CheckIn", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue({
      ...baseCheckIn,
      status: "Pending",
    } as any);

    await expect(
      createReview("customer-1", {
        checkInId: "check-in-1",
        rating: 3,
      }),
    ).rejects.toThrow("đã được xác minh");
  });

  it("rejects a Verified CheckIn without verifiedAt", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue({
      ...baseCheckIn,
      verifiedAt: null,
    } as any);

    await expect(
      createReview("customer-1", {
        checkInId: "check-in-1",
        rating: 4,
      }),
    ).rejects.toThrow("đã được xác minh");
  });

  it("rejects a merchant that does not match the CheckIn", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
      baseCheckIn as any,
    );

    await expect(
      createReview("customer-1", {
        checkInId: "check-in-1",
        merchantId: "merchant-2",
        rating: 4,
      }),
    ).rejects.toThrow("Merchant ID không khớp");
  });

  it("rejects a second review for the same CheckIn", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
      baseCheckIn as any,
    );
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue({
      id: "existing-review",
    } as any);

    await expect(
      createReview("customer-1", {
        checkInId: "check-in-1",
        rating: 5,
      }),
    ).rejects.toThrow("đã được đánh giá");
  });

  it("updates Merchant rating aggregate after a new Review", async () => {
    vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
      baseCheckIn as any,
    );
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue(null);
    const { aggregate, merchantUpdate } = setupCheckInCreate(
      makeReview({ rating: 4 }),
      4,
    );

    await createReview("customer-1", {
      checkInId: "check-in-1",
      rating: 4,
    });

    expect(aggregate).toHaveBeenCalled();
    expect(merchantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "merchant-1" },
        data: expect.objectContaining({
          reviewCount: 1,
        }),
      }),
    );
  });

  it("does not treat a completed Order without CheckIn as verified", async () => {
    vi.spyOn(prisma.review, "findMany").mockResolvedValue([
      makeReview({
        checkInId: null,
        orderId: "order-1",
        checkIn: null,
        order: {
          id: "order-1",
          orderedAt: verifiedAt,
          completedAt: verifiedAt,
          checkIn: null,
        },
      }),
    ] as any);

    const [result] = await getMyReviews("customer-1");

    expect(result?.orderId).toBe("order-1");
    expect(result?.checkInId).toBeNull();
    expect(result?.isVerifiedDiner).toBe(false);
  });

  it("updates a Review and recalculates Merchant rating", async () => {
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue({
      id: "review-1",
      customerId: "customer-1",
      merchantId: "merchant-1",
      merchant: {
        userId: "merchant-user",
        name: "Merchant",
      },
    } as any);
    vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);

    const updatedReview = makeReview({ rating: 5 });
    const merchantUpdate = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (operation: any) =>
        operation({
          review: {
            update: vi.fn().mockResolvedValue({}),
            findUniqueOrThrow: vi.fn().mockResolvedValue(updatedReview),
            aggregate: vi.fn().mockResolvedValue({
              _avg: { rating: 5 },
              _count: { rating: 1 },
            }),
          },
          merchant: { update: merchantUpdate },
          reviewDetail: { update: vi.fn() },
        }) as any,
    );

    const result = await updateReview("customer-1", "review-1", {
      rating: 5,
    });

    expect(result.rating).toBe(5);
    expect(merchantUpdate).toHaveBeenCalled();
  });

  it("deletes a Review and recalculates Merchant rating", async () => {
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue({
      id: "review-1",
      customerId: "customer-1",
      merchantId: "merchant-1",
    } as any);

    const reviewDelete = vi.fn().mockResolvedValue({});
    const merchantUpdate = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (operation: any) =>
        operation({
          review: {
            delete: reviewDelete,
            aggregate: vi.fn().mockResolvedValue({
              _avg: { rating: 0 },
              _count: { rating: 0 },
            }),
          },
          merchant: { update: merchantUpdate },
        }) as any,
    );

    const result = await deleteReview("customer-1", "review-1");

    expect(result.reviewId).toBe("review-1");
    expect(reviewDelete).toHaveBeenCalledWith({
      where: { id: "review-1" },
    });
    expect(merchantUpdate).toHaveBeenCalled();
  });

  it("keeps Legacy Order Review available", async () => {
    vi.spyOn(prisma.order, "findUnique").mockResolvedValue({
      id: "order-1",
      customerId: "customer-1",
      merchantId: "merchant-1",
      status: "Completed",
      details: [],
      checkIn: null,
      merchant: {
        userId: "merchant-user",
        name: "Merchant",
      },
    } as any);
    vi.spyOn(prisma.review, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      userId: "customer-user",
      reviewerPoints: 0,
      gemPoints: 0,
    } as any);
    vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);

    const legacyReview = makeReview({
      orderId: "order-1",
      checkInId: null,
      checkIn: null,
      order: {
        id: "order-1",
        orderedAt: verifiedAt,
        completedAt: verifiedAt,
        checkIn: null,
      },
    });

    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (operation: any) =>
        operation({
          review: {
            create: vi.fn().mockResolvedValue(legacyReview),
            aggregate: vi.fn().mockResolvedValue({
              _avg: { rating: 4 },
              _count: { rating: 1 },
            }),
          },
          merchant: { update: vi.fn().mockResolvedValue({}) },
          customer: {
            findUnique: vi.fn().mockResolvedValue({ gemPoints: 0 }),
            update: vi.fn().mockResolvedValue({}),
          },
          reviewerPointTransaction: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({}),
          },
        }) as any,
    );

    const result = await createReview("customer-1", {
      orderId: "order-1",
      rating: 4,
      details: [],
    });

    expect(result.orderId).toBe("order-1");
    expect(result.checkInId).toBeNull();
  });
});

describe("Phase 2 Review API contract", () => {
  const checkInId = "11111111-1111-4111-8111-111111111111";
  const orderId = "22222222-2222-4222-8222-222222222222";

  it("rejects a payload containing both checkInId and orderId", () => {
    const result = createReviewSchema.safeParse({
      body: {
        checkInId,
        orderId,
        rating: 4,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects Order Details on a CheckIn Review", () => {
    const result = createReviewSchema.safeParse({
      body: {
        checkInId,
        rating: 4,
        details: [
          {
            orderDetailId: "33333333-3333-4333-8333-333333333333",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts a CheckIn Review without an Order", () => {
    const result = createReviewSchema.safeParse({
      body: {
        checkInId,
        rating: 1,
      },
    });

    expect(result.success).toBe(true);
  });
});
