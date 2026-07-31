import { z } from "zod";
export const notificationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Notification ID không hợp lệ"),
    }),
});
export const notificationListSchema = z.object({
    query: z.object({
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(100),
        isRead: z.enum(["true", "false"]).optional(),
    }),
});
