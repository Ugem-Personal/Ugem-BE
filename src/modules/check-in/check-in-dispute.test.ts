import { describe, expect, it, vi } from "vitest";
import { prisma } from "../../config/prisma.js";
import { disputeCheckIn } from "./check-in.service.js";

describe("disputeCheckIn acquisition event handling", () => {
  it("marks the event disputed and records the transition instead of deleting it", async () => {
    vi.spyOn(prisma.checkIn, "findFirst").mockResolvedValue({
      id: "check-in-1",
      merchantId: "merchant-1",
      status: "Verified",
      customer: { userId: "customer-user-1" },
      acquisitionEvent: { id: "event-1", status: "Valid" },
    } as any);

    const checkInUpdate = vi.fn().mockResolvedValue({ id: "check-in-1", status: "Disputed" });
    const eventUpdate = vi.fn().mockResolvedValue({ id: "event-1", status: "Disputed" });
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation(async (operation: any) =>
      operation({
        checkIn: { update: checkInUpdate },
        merchantAcquisitionEvent: { update: eventUpdate },
        auditLog: { create: auditCreate },
      }),
    );

    const result = await disputeCheckIn("customer-1", "check-in-1", "Not my visit");

    expect(result.status).toBe("Disputed");
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: "Disputed" },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ oldStatus: "Valid", newStatus: "Disputed" }),
      }),
    }));
  });
});
