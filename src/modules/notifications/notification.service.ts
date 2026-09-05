import {
  NotificationType,
  Prisma,
  UserRole,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string | null;
  referenceType?: string | null;
}

interface NotificationListQuery {
  pageIndex: number;
  pageSize: number;
  isRead?: boolean;
}

const buildNotificationUrl = (
  referenceType?: string | null,
  referenceId?: string | null,
): string | null => {
  if (!referenceType || !referenceId) {
    return null;
  }

  switch (referenceType) {
    case "Order":
      return `/orders/${referenceId}`;

    case "Merchant":
      return `/merchants/${referenceId}`;

    case "Application":
      return `/applications/${referenceId}`;

    case "ReviewerApplication":
      return `/reviewer-application`;

    case "Campaign":
      return `/campaigns/${referenceId}`;

    case "Review":
      return `/reviews/${referenceId}`;

    case "SupportTicket":
      return `/merchant/support/${referenceId}`;

    default:
      return null;
  }
};

const mapNotification = (notification: any) => {
  const actionUrl = buildNotificationUrl(
    notification.referenceType,
    notification.referenceId,
  );

  return {
    id: notification.id,
    userId: notification.userId,

    type: notification.type,
    title: notification.title,

    message: notification.message,

    referenceId: notification.referenceId,

    referenceType: notification.referenceType,

    actionUrl,

    metadata: {
      referenceId: notification.referenceId,

      referenceType: notification.referenceType,
    },

    isRead: notification.isRead,

    createdAt: notification.createdAt,

    /*
     * Model Notification không có updatedAt,
     * nên dùng readAt nếu đã đọc, ngược lại dùng createdAt.
     */
    updatedAt: notification.readAt ?? notification.createdAt,

    readAt: notification.readAt,
  };
};

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,

      referenceId: input.referenceId ?? null,

      referenceType: input.referenceType ?? null,
    },
  });

  return mapNotification(notification);
};

export const createNotifications = async (
  inputs: CreateNotificationInput[],
) => {
  if (inputs.length === 0) return { count: 0 };

  return prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      referenceId: input.referenceId ?? null,
      referenceType: input.referenceType ?? null,
    })),
  });
};

export const notifyActiveUsersByRoles = async (
  roles: UserRole[],
  notification: Omit<CreateNotificationInput, "userId">,
) => {
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: roles },
      isActive: true,
    },
    select: { id: true },
  });

  return createNotifications(
    recipients.map((recipient) => ({
      ...notification,
      userId: recipient.id,
    })),
  );
};

export const getMyNotifications = async (
  userId: string,
  query: NotificationListQuery,
) => {
  const pageIndex = query.pageIndex || 1;

  const pageSize = query.pageSize || 10;

  const where: Prisma.NotificationWhereInput = {
    userId,

    isRead: query.isRead !== undefined ? query.isRead : undefined,
  };

  const [notifications, totalItems] = await prisma.$transaction([
    prisma.notification.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip: (pageIndex - 1) * pageSize,

      take: pageSize,
    }),

    prisma.notification.count({
      where,
    }),
  ]);

  return {
    items: notifications.map(mapNotification),

    totalItems,
    pageIndex,
    pageSize,

    totalPages: Math.ceil(totalItems / pageSize),
  };
};

export const getUnreadCount = async (userId: string) => {
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return {
    unreadCount,
  };
};

export const markNotificationAsRead = async (
  userId: string,
  notificationId: string,
) => {
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
  });

  if (!notification) {
    throw new AppError(404, "Không tìm thấy Notification");
  }

  if (notification.userId !== userId) {
    throw new AppError(403, "Bạn không có quyền đọc Notification này");
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId,
    },

    data: {
      isRead: true,
      readAt: notification.readAt ?? new Date(),
    },
  });

  return mapNotification(updated);
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },

    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return {
    updatedCount: result.count,
  };
};
