import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import { paginationMeta } from "../../common/utils/pagination.js";

import * as notificationService from "./notification.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.UserId;

  if (!userId) {
    throw new AppError(401, "Không xác định được người dùng");
  }

  return userId;
};

const getParam = (req: Request, name: string): string => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return value;
};

export const getMyNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const isRead =
      req.query.isRead === undefined ? undefined : req.query.isRead === "true";

    const result = await notificationService.getMyNotifications(
      getUserId(req),
      {
        pageIndex: Number(req.query.pageIndex ?? 1),

        pageSize: Number(req.query.pageSize ?? 100),

        isRead,
      },
    );

    return sendSuccess(res, {
      message: "Lấy danh sách Notification thành công",
      data: result.items,
      meta: paginationMeta(result),
    });
  },
);

export const getUnreadCount = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await notificationService.getUnreadCount(getUserId(req));

    return sendSuccess(res, {
      message: "Lấy số Notification chưa đọc thành công",
      data: result,
    });
  },
);

export const markNotificationAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    await notificationService.markNotificationAsRead(
      getUserId(req),
      getParam(req, "id"),
    );

    return sendSuccess(res, {
      message: "Đánh dấu Notification đã đọc thành công",
      data: null,
    });
  },
);

export const markAllNotificationsAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    await notificationService.markAllNotificationsAsRead(getUserId(req));

    return sendSuccess(res, {
      message: "Đánh dấu tất cả Notification đã đọc thành công",
      data: null,
    });
  },
);
