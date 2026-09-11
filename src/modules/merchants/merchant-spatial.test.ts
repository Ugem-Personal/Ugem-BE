import { describe, expect, it, vi } from "vitest";
import { getMerchants } from "./merchant.service.js";
import { prisma } from "../../config/prisma.js";

describe("getMerchants Spatial Filtering", () => {
  it("applies bounding box pre-filtering to where clause when latitude and longitude are provided", async () => {
    const findManySpy = vi.spyOn(prisma.merchant, "findMany").mockResolvedValue([]);

    const customerLat = 10.7769;
    const customerLng = 106.7009;
    const radiusKm = 10;

    await getMerchants({
      latitude: customerLat,
      longitude: customerLng,
      radiusKm,
    });

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          latitude: expect.objectContaining({
            gte: expect.anything(),
            lte: expect.anything(),
          }),
          longitude: expect.objectContaining({
            gte: expect.anything(),
            lte: expect.anything(),
          }),
        }),
      }),
    );
  });
});
