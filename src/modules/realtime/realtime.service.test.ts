import { describe, expect, it, vi } from "vitest";
import { realtimeService } from "./realtime.service.js";

describe("RealtimeService", () => {
  it("registers and unregisters clients correctly", () => {
    const mockRes = {
      write: vi.fn(),
      end: vi.fn(),
    } as any;

    const clientId = "test-client-1";
    const userId = "user-123";
    const merchantId = "merchant-456";

    const client = realtimeService.registerClient(
      clientId,
      mockRes,
      userId,
      "Merchant",
      merchantId,
    );

    expect(client).toBeDefined();
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining("CONNECTED"));

    // Send to merchant
    const sentCount = realtimeService.sendToMerchant(merchantId, "order:new", {
      orderId: "order-999",
    });
    expect(sentCount).toBe(1);
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining("order:new"));

    // Unregister
    realtimeService.unregisterClient(clientId);
    const sentAfterUnregister = realtimeService.sendToMerchant(
      merchantId,
      "order:new",
      { orderId: "order-999" },
    );
    expect(sentAfterUnregister).toBe(0);
  });

  it("broadcasts messages to all connected clients", () => {
    const mockRes1 = { write: vi.fn(), end: vi.fn() } as any;
    const mockRes2 = { write: vi.fn(), end: vi.fn() } as any;

    realtimeService.registerClient("client-a", mockRes1, "user-a", "Customer");
    realtimeService.registerClient("client-b", mockRes2, "user-b", "Staff");

    const count = realtimeService.broadcast("notification:new", {
      title: "Test System Announcement",
    });
    expect(count).toBeGreaterThanOrEqual(2);

    expect(mockRes1.write).toHaveBeenCalledWith(expect.stringContaining("notification:new"));
    expect(mockRes2.write).toHaveBeenCalledWith(expect.stringContaining("notification:new"));

    realtimeService.unregisterClient("client-a");
    realtimeService.unregisterClient("client-b");
  });
});
