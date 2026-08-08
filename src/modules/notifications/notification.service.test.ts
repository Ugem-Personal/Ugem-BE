import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NotificationType,
  UserRole,
} from "../../generated/prisma/client.js";

const prismaMocks = vi.hoisted(() => ({
  findUsers: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: {
      findMany: prismaMocks.findUsers,
    },
    notification: {
      createMany: prismaMocks.createMany,
    },
  },
}));

import {
  createNotifications,
  notifyActiveUsersByRoles,
} from "./notification.service.js";

describe("notification fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.createMany.mockResolvedValue({ count: 0 });
  });

  it("does not write when there are no recipients", async () => {
    await expect(createNotifications([])).resolves.toEqual({ count: 0 });
    expect(prismaMocks.createMany).not.toHaveBeenCalled();
  });

  it("sends an application notification to every active Staff and Admin", async () => {
    prismaMocks.findUsers.mockResolvedValue([{ id: "staff-1" }, { id: "admin-1" }]);
    prismaMocks.createMany.mockResolvedValue({ count: 2 });

    await notifyActiveUsersByRoles([UserRole.Staff, UserRole.Admin], {
      type: NotificationType.Application,
      title: "Có hồ sơ mới",
      message: "Một hồ sơ đang chờ duyệt.",
      referenceId: "application-1",
      referenceType: "Application",
    });

    expect(prismaMocks.findUsers).toHaveBeenCalledWith({
      where: {
        role: { in: [UserRole.Staff, UserRole.Admin] },
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaMocks.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: "staff-1", referenceId: "application-1" }),
        expect.objectContaining({ userId: "admin-1", referenceId: "application-1" }),
      ],
    });
  });
});
