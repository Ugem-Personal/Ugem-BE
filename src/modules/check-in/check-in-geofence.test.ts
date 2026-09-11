import { describe, expect, it, vi } from "vitest";
import { verifyCheckIn } from "./check-in.service.js";
import { prisma } from "../../config/prisma.js";

describe("verifyCheckIn Geo-fencing", () => {
  const merchantLat = 10.7769; // District 1, HCMC
  const merchantLng = 106.7009;

  const mockOrder = {
    id: "order-checkin-1",
    customerId: "cust-1",
    merchantId: "merch-1",
    orderType: "Offline",
    status: "Completed",
    paymentStatus: "Paid",
    merchant: {
      id: "merch-1",
      name: "Bếp Nhà UAT",
      latitude: merchantLat,
      longitude: merchantLng,
    },
    customer: {
      id: "cust-1",
      userId: "user-cust-1",
    },
  };

  it("accepts check-in when customer is within 100 meters", async () => {
    // ~30 meters away from merchant
    const customerLat = 10.7771;
    const customerLng = 106.7010;

    vi.spyOn(prisma.order, "findUnique").mockResolvedValue(mockOrder as any);
    vi.spyOn(prisma.checkIn, "updateMany").mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.customer, "findUnique").mockResolvedValue({ reviewerPoints: 50 } as any);
    vi.spyOn(prisma, "$transaction").mockResolvedValue([{}, {}] as any);
    vi.spyOn(prisma.notification, "create").mockResolvedValue({} as any);

    const result = await verifyCheckIn(
      "cust-1",
      "order-checkin-1",
      "valid-token-123456789012345678901234567890",
      customerLat,
      customerLng,
    );

    expect(result.status).toBe("Verified");
    expect(result.distanceMeters).toBeLessThanOrEqual(100);
    expect(result.pointsAwarded).toBe(10);
  });

  it("rejects check-in when customer is farther than 100 meters (e.g. 500 meters away)", async () => {
    // Far away (~1.5 km away)
    const customerLat = 10.7900;
    const customerLng = 106.7009;

    vi.spyOn(prisma.order, "findUnique").mockResolvedValue(mockOrder as any);
    const checkInUpdateSpy = vi.spyOn(prisma.checkIn, "updateMany").mockResolvedValue({ count: 1 });
    const auditLogSpy = vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);

    await expect(
      verifyCheckIn(
        "cust-1",
        "order-checkin-1",
        "valid-token-123456789012345678901234567890",
        customerLat,
        customerLng,
      ),
    ).rejects.toThrow(/quá xa quán/);

    expect(checkInUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "Rejected" },
      }),
    );
    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CHECKIN_GEOFENCE_FAILED",
        }),
      }),
    );
  });
});
