import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notification.controller.js";

import {
  notificationIdSchema,
  notificationListSchema,
} from "./notification.schema.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get("/unread-count", getUnreadCount);

notificationRouter.patch("/read-all", markAllNotificationsAsRead);

notificationRouter.get(
  "/",
  validate(notificationListSchema),
  getMyNotifications,
);

notificationRouter.patch(
  "/:id/read",
  validate(notificationIdSchema),
  markNotificationAsRead,
);
