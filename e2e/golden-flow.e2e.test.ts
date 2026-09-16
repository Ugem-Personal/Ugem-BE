import type { Server } from "node:http";

import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { disputeCheckIn, verifyCheckIn } from "../src/modules/check-in/check-in.service.js";
import {
  OrderPaymentStatus,
  OrderStatus,
  UserRole,
} from "../src/generated/prisma/client.js";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta: {
    pageIndex: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
  traceId: string;
};

type SessionData = {
  accessToken: string;
  user: {
    id: string;
    customerId?: string | null;
    merchantId?: string | null;
  };
};

let server: Server;
let baseUrl = "";
let adminToken = "";
let customerToken = "";
let merchantToken = "";
let merchantUserId = "";
let merchantId = "";
let foodId = "";
let customerId = "";

const apiRequest = async <T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    apiKey?: string;
    body?: unknown;
  } = {},
) => {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.apiKey
        ? { Authorization: `Apikey ${options.apiKey}` }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  return { response, payload };
};

const createCheckInFixture = async (suffix: string, expiresAt: Date) => {
  const order = await prisma.order.create({
    data: {
      customerId,
      merchantId,
      name: `Check-in ${suffix}`,
      orderType: "Offline",
      paymentMethod: "Cash",
      status: "Completed",
      paymentStatus: "Paid",
      subtotal: 25_000,
      finalPrice: 25_000,
      completedAt: new Date(),
    },
  });
  const token = `e2e-checkin-token-${suffix}-0123456789abcdef`;
  const checkIn = await prisma.checkIn.create({
    data: {
      orderId: order.id,
      customerId,
      merchantId,
      qrToken: createHash("sha256").update(token).digest("hex"),
      generatedAt: new Date(Date.now() - 60_000),
      expiresAt,
      source: "OrderQr",
      checkInMethod: "OrderQr",
    },
  });
  return { order, checkIn, token };
};

const resetTestDatabase = async () => {
  const [{ databaseName }] = await prisma.$queryRaw<
    Array<{ databaseName: string }>
  >`SELECT current_database() AS "databaseName"`;

  if (!databaseName?.endsWith("_test")) {
    throw new Error(
      `E2E từ chối reset database '${databaseName ?? "unknown"}'`,
    );
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const quotedTables = tables
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
  );
};

beforeAll(async () => {
  await resetTestDatabase();

  const passwordHash = await bcrypt.hash("AdminPassword123", 12);

  await prisma.user.create({
    data: {
      email: "admin.e2e@ugem.test",
      passwordHash,
      fullName: "Admin E2E",
      role: UserRole.Admin,
      isActive: true,
    },
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Không lấy được port E2E");
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

describe.sequential("UGem golden flow", () => {
  it("protects privileged registration and enforces Admin RBAC", async () => {
    const invalidAdminRegistration = await apiRequest<SessionData>(
      "/auth/register",
      {
        method: "POST",
        body: {
          email: "attacker@ugem.test",
          password: "AttackerPassword123",
          fullName: "Attacker",
          role: "Admin",
        },
      },
    );

    expect(invalidAdminRegistration.response.status).toBe(400);

    const adminLogin = await apiRequest<SessionData>("/auth/login", {
      method: "POST",
      body: {
        email: "admin.e2e@ugem.test",
        password: "AdminPassword123",
      },
    });

    expect(adminLogin.response.status).toBe(200);
    adminToken = adminLogin.payload.data.accessToken;

    const customerRegistration = await apiRequest<SessionData>(
      "/auth/register",
      {
        method: "POST",
        body: {
          email: "customer.e2e@ugem.test",
          password: "CustomerPassword123",
          fullName: "Customer E2E",
          phoneNumber: "0988000001",
          role: "Customer",
        },
      },
    );

    expect(customerRegistration.response.status).toBe(201);
    customerToken = customerRegistration.payload.data.accessToken;
    customerId = customerRegistration.payload.data.user.customerId ?? "";
    expect(customerId).toBeTruthy();

    const forbiddenAdminAccess = await apiRequest("/admin/staff", {
      token: customerToken,
    });
    expect(forbiddenAdminAccess.response.status).toBe(403);

    const createStaff = await apiRequest<{ id: string }>("/admin/staff", {
      method: "POST",
      token: adminToken,
      body: {
        email: "staff.e2e@ugem.test",
        password: "StaffPassword123",
        fullName: "Staff E2E",
        phoneNumber: "0988000002",
      },
    });
    expect(createStaff.response.status).toBe(201);

    const auditLogs = await apiRequest<{
      items: Array<{ action: string; entityId: string }>;
    }>("/admin/audit-logs", { token: adminToken });

    expect(auditLogs.response.status).toBe(200);
    expect(auditLogs.payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "STAFF_CREATED",
          entityId: createStaff.payload.data.id,
        }),
      ]),
    );
  });

  it("creates an approved merchant fixture and authenticates it", async () => {
    const merchantRegistration = await apiRequest<SessionData>(
      "/auth/register",
      {
        method: "POST",
        body: {
          email: "merchant.e2e@ugem.test",
          password: "MerchantPassword123",
          fullName: "Merchant Owner E2E",
          phoneNumber: "0988000003",
          role: "Merchant",
        },
      },
    );

    expect(merchantRegistration.response.status).toBe(201);
    merchantUserId = merchantRegistration.payload.data.user.id;

    const merchant = await prisma.merchant.create({
      data: {
        userId: merchantUserId,
        name: "UGem E2E Kitchen",
        restaurantType: "Restaurant",
        mainDishType: "Vietnamese",
        priceRange: "50000-200000",
        email: "merchant.e2e@ugem.test",
        phone: "0988000003",
        address: "1 Test Street",
        openingHours: "08:00-22:00",
        bankCode: "MB",
        bankAccountNumber: "0988000003",
        bankAccountName: "MERCHANT E2E",
        bankTransferEnabled: true,
        status: "Active",
        latitude: 10.7769,
        longitude: 106.7009,
      },
    });
    merchantId = merchant.id;

    const food = await prisma.food.create({
      data: {
        merchantId,
        name: "Cơm E2E",
        description: "Golden flow fixture",
        price: 75_000,
        isAvailable: true,
      },
    });
    foodId = food.id;

    const merchantLogin = await apiRequest<SessionData>("/auth/login", {
      method: "POST",
      body: {
        email: "merchant.e2e@ugem.test",
        password: "MerchantPassword123",
      },
    });

    expect(merchantLogin.response.status).toBe(200);
    expect(merchantLogin.payload.data.user.merchantId).toBe(merchantId);
    merchantToken = merchantLogin.payload.data.accessToken;
  });

  it("runs the complete online order lifecycle", async () => {
    const createdOrder = await apiRequest<{
      orderId: string;
      status: string;
    }>("/orders", {
      method: "POST",
      token: customerToken,
      body: {
        name: "Customer E2E",
        paymentMethod: "COD",
        deliveryAddress: "2 Delivery Street",
        deliveryLatitude: 10.7769,
        deliveryLongitude: 106.7009,
        orderType: "Online",
        foods: [{ foodId, quantity: 2, foodToppingIds: [] }],
      },
    });

    expect(createdOrder.response.status).toBe(201);
    expect(createdOrder.payload.data.status).toBe(OrderStatus.Pending);
    expect(createdOrder.payload.meta).toBeNull();
    expect(createdOrder.payload.data).not.toHaveProperty("id");
    const orderId = createdOrder.payload.data.orderId;

    const orderPage = await apiRequest<Array<{ orderId: string }>>(
      "/orders/mine?pageIndex=1&pageSize=1",
      { token: customerToken },
    );
    expect(orderPage.response.status).toBe(200);
    expect(orderPage.payload.data).toHaveLength(1);
    expect(orderPage.payload.meta).toEqual({
      pageIndex: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });

    const prematureCompletion = await apiRequest(`/orders/${orderId}/status`, {
      method: "PATCH",
      token: customerToken,
      body: { status: "Completed" },
    });
    expect(prematureCompletion.response.status).toBe(409);

    for (const status of [
      OrderStatus.Accepted,
      OrderStatus.Preparing,
      OrderStatus.Ready,
      OrderStatus.Delivering,
    ]) {
      const transition = await apiRequest<{ status: string }>(
        `/orders/${orderId}/status`,
        {
          method: "PATCH",
          token: merchantToken,
          body: { status },
        },
      );

      expect(transition.response.status).toBe(200);
      expect(transition.payload.data.status).toBe(status);
    }

    const completion = await apiRequest<{ status: string }>(
      `/orders/${orderId}/status`,
      {
        method: "PATCH",
        token: customerToken,
        body: { status: "Completed" },
      },
    );

    expect(completion.response.status).toBe(200);
    expect(completion.payload.data.status).toBe(OrderStatus.Completed);

    const persistedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(persistedOrder.completedAt).toBeInstanceOf(Date);
  });

  it("authenticates and idempotently processes a SePay webhook", async () => {
    const createdOrder = await apiRequest<{
      orderId: string;
      finalPrice: number;
    }>("/orders", {
      method: "POST",
      token: customerToken,
      body: {
        name: "Customer SePay E2E",
        paymentMethod: "SePay",
        deliveryAddress: "3 Payment Street",
        deliveryLatitude: 10.7769,
        deliveryLongitude: 106.7009,
        orderType: "Online",
        foods: [{ foodId, quantity: 1, foodToppingIds: [] }],
      },
    });
    expect(createdOrder.response.status).toBe(201);

    const { orderId, finalPrice } = createdOrder.payload.data;

    const accepted = await apiRequest(`/orders/${orderId}/status`, {
      method: "PATCH",
      token: merchantToken,
      body: { status: "Accepted" },
    });
    expect(accepted.response.status).toBe(200);

    const ready = await apiRequest(`/orders/${orderId}/status`, {
      method: "PATCH",
      token: merchantToken,
      body: { status: "Ready" },
    });
    expect(ready.response.status).toBe(200);

    const submittedBill = await apiRequest("/orders/bill", {
      method: "PATCH",
      token: merchantToken,
      body: {
        orderId,
        transferContent: `UGEM-${orderId}`,
      },
    });
    expect(submittedBill.response.status).toBe(200);

    const webhookBody = {
      orderId,
      referenceCode: `SEPAY-E2E-${orderId}`,
      transferAmount: finalPrice,
      content: `UGEM-${orderId}`,
      transferType: "in",
      accountNumber: "0988000003",
    };

    const rejectedWebhook = await apiRequest("/orders/sepay/webhook", {
      method: "POST",
      apiKey: "wrong-key",
      body: webhookBody,
    });
    expect(rejectedWebhook.response.status).toBe(401);

    const validApiKey = process.env.SEPAY_WEBHOOK_API_KEY;
    expect(validApiKey).toBeTruthy();

    const firstWebhook = await apiRequest<{ sepayReference: string }>(
      "/orders/sepay/webhook",
      {
        method: "POST",
        apiKey: validApiKey,
        body: webhookBody,
      },
    );
    expect(firstWebhook.response.status).toBe(200);
    const persistedBillAfterWebhook = await prisma.bill.findUniqueOrThrow({
      where: { orderId },
    });
    expect(persistedBillAfterWebhook.sepayReference).toBe(`SEPAY-E2E-${orderId}`);

    const duplicateWebhook = await apiRequest<{ id: string }>(
      "/orders/sepay/webhook",
      {
        method: "POST",
        apiKey: validApiKey,
        body: webhookBody,
      },
    );
    expect(duplicateWebhook.response.status).toBe(200);

    const persistedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const billCount = await prisma.bill.count({ where: { orderId } });

    expect(persistedOrder.paymentStatus).toBe(OrderPaymentStatus.Paid);
    expect(billCount).toBe(1);
  });

  it("creates a Valid acquisition event only after verified QR and geofence", async () => {
    const fixture = await createCheckInFixture("verified", new Date(Date.now() + 10 * 60_000));
    const result = await verifyCheckIn(customerId, fixture.order.id, fixture.token, 10.777, 106.701);
    const event = await prisma.merchantAcquisitionEvent.findUnique({ where: { checkInId: fixture.checkIn.id } });
    expect(result.status).toBe("Verified");
    expect(event?.status).toBe("Valid");
    expect(event?.verificationMethod).toBe("OrderQr");
  });

  it("rejects invalid QR replay and creates no acquisition event", async () => {
    const fixture = await createCheckInFixture("invalid", new Date(Date.now() + 10 * 60_000));
    await expect(verifyCheckIn(customerId, fixture.order.id, "wrong-token-012345678901234567890123456", 10.777, 106.701)).rejects.toThrow();
    expect(await prisma.merchantAcquisitionEvent.count({ where: { checkInId: fixture.checkIn.id } })).toBe(0);
    expect((await prisma.checkIn.findUniqueOrThrow({ where: { id: fixture.checkIn.id } })).status).toBe("Rejected");
  });

  it("expires an expired QR without creating an acquisition event", async () => {
    const fixture = await createCheckInFixture("expired", new Date(Date.now() - 60_000));
    await expect(verifyCheckIn(customerId, fixture.order.id, fixture.token, 10.777, 106.701)).rejects.toThrow();
    expect(await prisma.merchantAcquisitionEvent.count({ where: { checkInId: fixture.checkIn.id } })).toBe(0);
    expect((await prisma.checkIn.findUniqueOrThrow({ where: { id: fixture.checkIn.id } })).status).toBe("Expired");
  });

  it("retains disputed acquisition for audit and excludes it from valid metrics", async () => {
    const verified = await prisma.checkIn.findFirstOrThrow({ where: { customerId, merchantId, status: "Verified" } });
    const eventBefore = await prisma.merchantAcquisitionEvent.findUniqueOrThrow({ where: { checkInId: verified.id } });
    await disputeCheckIn(customerId, verified.id, "E2E dispute reason");
    const eventAfter = await prisma.merchantAcquisitionEvent.findUniqueOrThrow({ where: { id: eventBefore.id } });
    const validMetric = await prisma.merchantAcquisitionEvent.count({ where: { merchantId, status: "Valid" } });
    const audit = await prisma.auditLog.findFirst({ where: { action: "MERCHANT_ACQUISITION_DISPUTED", entityId: verified.id }, orderBy: { createdAt: "desc" } });
    expect(eventAfter.status).toBe("Disputed");
    expect(validMetric).toBe(0);
    expect(audit?.metadata).toMatchObject({ oldStatus: "Valid", newStatus: "Disputed", reason: "E2E dispute reason" });
  });

  it("suppresses and hides a merchant after a Critical incident review", async () => {
    const created = await apiRequest<{ id: string }>("/moderation/incidents", {
      method: "POST", token: customerToken,
      body: { merchantId, type: "FoodSafety", severity: "Medium", description: "E2E safety incident requiring review." },
    });
    expect(created.response.status).toBe(200);
    const reviewed = await apiRequest(`/moderation/admin/incidents/${created.payload.data.id}`, {
      method: "PATCH", token: adminToken, body: { status: "UnderReview", severity: "Critical", adminDecision: "Escalated in E2E" },
    });
    expect(reviewed.response.status).toBe(200);
    const merchant = await prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } });
    expect(merchant.safetySuppressed).toBe(true);
    expect(merchant.listingVisibility).toBe("Hidden");
  });

  it("approves removal by hiding listing while retaining the merchant row", async () => {
    const request = await apiRequest<{ id: string }>("/moderation/removal-requests", {
      method: "POST", token: merchantToken, body: { merchantId, reason: "E2E owner requested removal." },
    });
    expect(request.response.status).toBe(200);
    const reviewed = await apiRequest(`/moderation/admin/removal-requests/${request.payload.data.id}`, {
      method: "PATCH", token: adminToken, body: { status: "Approved", decision: "Approved in E2E" },
    });
    expect(reviewed.response.status).toBe(200);
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    expect(merchant).not.toBeNull();
    expect(merchant?.status).toBe("Inactive");
    expect(merchant?.verificationStatus).toBe("Removed");
    expect(merchant?.listingVisibility).toBe("Hidden");
  });

  it("approves a claim by transferring ownership and changing account roles", async () => {
    const priorOwner = await prisma.user.create({ data: { email: "claim-owner.e2e@ugem.test", passwordHash: await bcrypt.hash("MerchantPassword123", 4), fullName: "Prior Owner", role: "Merchant" } });
    const claimMerchant = await prisma.merchant.create({
      data: {
        userId: priorOwner.id, name: "Claimable E2E Kitchen", restaurantType: "Restaurant", mainDishType: "Vietnamese",
        priceRange: "50000-200000", email: "claim-owner.e2e@ugem.test", phone: "0988000010", address: "10 Test Street",
        openingHours: "08:00-22:00", status: "Active",
      },
    });
    const claimant = await prisma.user.create({ data: { email: "claimant.e2e@ugem.test", passwordHash: await bcrypt.hash("CustomerPassword123", 4), fullName: "Claimant", role: "Customer", customer: { create: {} } } });
    const claim = await prisma.merchantClaim.create({ data: { merchantId: claimMerchant.id, submittedByUserId: claimant.id, evidenceUrls: ["https://example.test/proof"] } });
    const reviewed = await apiRequest(`/moderation/admin/claims/${claim.id}`, {
      method: "PATCH", token: adminToken, body: { status: "Approved", decision: "Ownership verified in E2E" },
    });
    expect(reviewed.response.status).toBe(200);
    const [merchant, claimantAfter, previousOwnerAfter] = await Promise.all([
      prisma.merchant.findUniqueOrThrow({ where: { id: claimMerchant.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: claimant.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: priorOwner.id } }),
    ]);
    expect(merchant.userId).toBe(claimant.id);
    expect(merchant.verificationStatus).toBe("VerifiedBusiness");
    expect(claimantAfter.role).toBe("Merchant");
    expect(previousOwnerAfter.role).toBe("Customer");
  });
});
