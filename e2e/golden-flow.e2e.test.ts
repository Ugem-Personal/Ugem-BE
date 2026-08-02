import type { Server } from "node:http";

import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
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
        status: "Active",
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
      referenceCode: "SEPAY-E2E-0001",
      transferAmount: finalPrice,
      content: `UGEM-${orderId}`,
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
    expect(firstWebhook.payload.data.sepayReference).toBe("SEPAY-E2E-0001");

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
});
