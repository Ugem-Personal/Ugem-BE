import { z } from "zod";
export const staffReviewerApplicationListSchema = z.object({
    query: z.object({
        status: z.enum(["Pending", "Accepted", "Rejected"]).optional(),
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
export const acceptReviewerApplicationSchema = z.object({
    body: z.object({
        applicationId: z.string().uuid("Application ID không hợp lệ"),
    }),
});
export const rejectReviewerApplicationSchema = z.object({
    body: z.object({
        applicationId: z.string().uuid("Application ID không hợp lệ"),
        reason: z
            .string()
            .trim()
            .min(1, "Lý do từ chối không được để trống")
            .max(1000, "Lý do từ chối không được vượt quá 1000 ký tự"),
    }),
});
