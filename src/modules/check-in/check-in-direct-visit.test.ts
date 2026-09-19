import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { merchantVerifyCustomerCode, verifyCheckIn } from "./check-in.service.js";

const merchant = {
  id: "merchant-1",
  userId: "merchant-user",
  name: "Test Merchant",
  logoUrl: null,
  latitude: 10.7769,
  longitude: 106.7009,
  status: "Active",
};

const customer = {
  id: "customer-1",
  userId: "customer-user",
  user: {
    id: "customer-user",
    fullName: "Test Customer",
    phoneNumber: "0900000000",
  },
};

const directToken = (claims: Record<string, unknown> = {}) =>
  jwt.sign(
    {
      type: "DirectVisit",
      merchantId: merchant.id,
      ...claims,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );

const setupDirectMocks = (options: {
  hourlyCheckIns?: number;
  existingCheckIn?: { id: string } | null;
  customerOverride?: Partial<typeof customer>;
} = {}) => {
  const txCheckInCreate = vi.fn().mockResolvedValue({ id: "check-in-1" });
  const acquisitionCreate = vi.fn().mockResolvedValue({});
  const pointClaimCreate = vi.fn().mockResolvedValue({ count: 1 });
  const pointTransactionUpdate = vi.fn().mockResolvedValue({});
  const customerUpdate = vi.fn().mockResolvedValue({ gemPoints: 10 });

  vi.spyOn(prisma.customer, "findUnique").mockResolvedValue({
    ...customer,
    ...options.customerOverride,
  } as any);
  vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue(merchant as any);
  vi.spyOn(prisma.checkIn, "count").mockResolvedValue(
    options.hourlyCheckIns ?? 0,
  );
  vi.spyOn(prisma.checkIn, "findUnique").mockResolvedValue(
    options.existingCheckIn ?? null,
  );
  vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
  vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);
  vi.spyOn(prisma, "$transaction").mockImplementation(
    async (operation: any) =>
      operation({
        checkIn: { create: txCheckInCreate },
        merchantAcquisitionEvent: { create: acquisitionCreate },
        customer: { update: customerUpdate },
        reviewerPointTransaction: {
          createMany: pointClaimCreate,
          update: pointTransactionUpdate,
        },
      }) as any,
  );

  return { txCheckInCreate, acquisitionCreate };
};

describe("Phase 1 orderless verified visits", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies Direct QR without an Order and returns orderId null", async () => {
    const { txCheckInCreate } = setupDirectMocks();

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      directToken(),
      10.7771,
      106.701,
    );

    expect(result.status).toBe("Verified");
    expect(result.orderId).toBeNull();
    expect(result.gemPointsAwarded).toBe(10);
    expect(txCheckInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: null,
          checkInMethod: "DirectQr",
          status: "Verified",
        }),
      }),
    );
  });

  it("creates a MerchantAcquisitionEvent without an Order", async () => {
    const { acquisitionCreate } = setupDirectMocks();

    const result = await verifyCheckIn(
      customer.id,
      undefined,
      directToken(),
      10.7771,
      106.701,
    );

    expect(result.orderId).toBeNull();
    expect(acquisitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: null,
          verificationMethod: "DirectQr",
          source: "DirectVisit",
        }),
      }),
    );
  });

  it("rejects a QR replay", async () => {
    const transaction = setupDirectMocks({
      existingCheckIn: { id: "already-used" },
    });

    await expect(
      verifyCheckIn(
        customer.id,
        undefined,
        directToken(),
        10.7771,
        106.701,
      ),
    ).rejects.toThrow("Ma QR nay da duoc su dung");

    expect(transaction.txCheckInCreate).not.toHaveBeenCalled();
  });

  it("rejects an expired JWT", async () => {
    const token = jwt.sign(
      { type: "DirectVisit", merchantId: merchant.id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -1 },
    );

    await expect(
      verifyCheckIn(customer.id, undefined, token, 10.7771, 106.701),
    ).rejects.toThrow("Ma QR check-in khong hop le");
  });

  it("rejects an invalid JWT", async () => {
    await expect(
      verifyCheckIn(
        customer.id,
        undefined,
        "invalid-token-value-with-enough-length",
        10.7771,
        106.701,
      ),
    ).rejects.toThrow("Ma QR check-in khong hop le");
  });

  it("rejects a visit outside the 100 meter geofence", async () => {
    setupDirectMocks();

    await expect(
      verifyCheckIn(customer.id, undefined, directToken(), 10.79, 106.7009),
    ).rejects.toThrow("Ban dang o qua xa quan");

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CHECKIN_GEOFENCE_FAILED",
        }),
      }),
    );
  });

  it("rejects merchant self check-in", async () => {
    setupDirectMocks({
      customerOverride: { userId: merchant.userId },
    });

    await expect(
      verifyCheckIn(
        customer.id,
        undefined,
        directToken(),
        10.7771,
        106.701,
      ),
    ).rejects.toThrow("Merchant khong the tu check-in");
  });

  it("rejects velocity at five verified check-ins per hour", async () => {
    setupDirectMocks({ hourlyCheckIns: 5 });

    await expect(
      verifyCheckIn(
        customer.id,
        undefined,
        directToken(),
        10.7771,
        106.701,
      ),
    ).rejects.toThrow("Tan suat check-in bat thuong");
  });

  it("verifies Customer Code without an Order and awards Gem Points", async () => {
    const txCheckInCreate = vi.fn().mockResolvedValue({ id: "check-in-code-1" });
    const acquisitionCreate = vi.fn().mockResolvedValue({});

    vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue(merchant as any);
    vi.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      ...customer,
      customerCode: "UGEM-ABC123",
    } as any);
    vi.spyOn(prisma.checkIn, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);
    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (operation: any) =>
        operation({
          checkIn: { create: txCheckInCreate },
          merchantAcquisitionEvent: { create: acquisitionCreate },
          customer: { update: vi.fn().mockResolvedValue({ gemPoints: 10 }) },
          reviewerPointTransaction: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue({}),
          },
        }) as any,
    );

    const result = await merchantVerifyCustomerCode(
      merchant.id,
      " ugem-abc123 ",
      "Free drink",
      "Present",
    );

    expect(result.orderId).toBeNull();
    expect(result.orderAmount).toBeNull();
    expect(result.status).toBe("Verified");
    expect(result.gemPointsAwarded).toBe(10);
    expect(result.gemPointsAwarded).toBe(10);
    expect(txCheckInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: null,
          checkInMethod: "CustomerCode",
        }),
      }),
    );
    expect(acquisitionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: null,
          verificationMethod: "CustomerCode",
          source: "CustomerCode",
        }),
      }),
    );
  });

  it("rejects Customer Code duplicate within two hours", async () => {
    vi.spyOn(prisma.merchant, "findUnique").mockResolvedValue(merchant as any);
    vi.spyOn(prisma.customer, "findUnique").mockResolvedValue({
      ...customer,
      customerCode: "UGEM-ABC123",
    } as any);
    vi.spyOn(prisma.checkIn, "findFirst").mockResolvedValue({
      id: "recent-check-in",
    } as any);
    const transaction = vi.spyOn(prisma, "$transaction");

    await expect(
      merchantVerifyCustomerCode(merchant.id, "UGEM-ABC123"),
    ).rejects.toThrow("trong vong 2 gio qua");

    expect(transaction).not.toHaveBeenCalled();
  });
});









