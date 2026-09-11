import { describe, expect, it, vi } from "vitest";
import { expireOverdueSepayOrders } from "./sepay-order-expiration.job.js";
import { prisma } from "../config/prisma.js";
import { realtimeService } from "../modules/realtime/realtime.service.js";

describe("expireOverdueSepayOrders", () => {
  it("processes and cancels overdue orders and updates campaign count", async () => {
    const mockNow = new Date("2026-09-11T12:00:00.000Z");
    const overdueOrderTime = new Date("2026-09-11T11:40:00.000Z"); // 20 mins ago

    const mockOverdueOrder = {
      id: "order-sepay-1",
      name: "Khách Demo",
      customerId: "cust-1",
      merchantId: "merch-1",
      campaignId: "camp-1",
      affiliateLinkId: "aff-1",
      paymentMethod: "SePay",
      paymentStatus: "Unpaid",
      status: "Pending",
      orderedAt: overdueOrderTime,
      customer: { userId: "user-cust-1" },
      merchant: { id: "merch-1", userId: "user-merch-1", name: "Quán Ăn UAT" },
      bill: { id: "bill-1" },
    };

    vi.spyOn(prisma.order, "findMany").mockResolvedValue([mockOverdueOrder as any]);

    const txMock = {
      order: { update: vi.fn().mockResolvedValue({}) },
      bill: { update: vi.fn().mockResolvedValue({}) },
      campaign: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      affiliateTransaction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      return cb(txMock);
    });

    const sendToUserSpy = vi.spyOn(realtimeService, "sendToUser").mockReturnValue(1);
    const sendToMerchantSpy = vi.spyOn(realtimeService, "sendToMerchant").mockReturnValue(1);

    const result = await expireOverdueSepayOrders({
      thresholdMinutes: 15,
      now: mockNow,
    });

    expect(result.expiredCount).toBe(1);

    // Verify order was cancelled
    expect(txMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-sepay-1" },
      data: expect.objectContaining({
        status: "Cancelled",
        paymentStatus: "Rejected",
      }),
    });

    // Verify campaign usedCount was decremented
    expect(txMock.campaign.updateMany).toHaveBeenCalledWith({
      where: {
        id: "camp-1",
        usedCount: { gt: 0 },
      },
      data: {
        usedCount: { decrement: 1 },
      },
    });

    // Verify realtime event was sent
    expect(sendToUserSpy).toHaveBeenCalledWith(
      "user-cust-1",
      "order:status_changed",
      expect.objectContaining({
        orderId: "order-sepay-1",
        status: "Cancelled",
      }),
    );
    expect(sendToMerchantSpy).toHaveBeenCalledWith(
      "merch-1",
      "order:status_changed",
      expect.objectContaining({
        orderId: "order-sepay-1",
        status: "Cancelled",
      }),
    );
  });

  it("returns 0 when no overdue orders are found", async () => {
    vi.spyOn(prisma.order, "findMany").mockResolvedValue([]);

    const result = await expireOverdueSepayOrders({
      thresholdMinutes: 15,
      now: new Date(),
    });

    expect(result.expiredCount).toBe(0);
  });
});
