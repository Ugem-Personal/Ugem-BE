import { z } from "zod";
const category = z.enum([
    "Orders",
    "Delivery",
    "Payment",
    "Menu",
    "Account",
    "Other",
]);
const priority = z.enum(["Low", "Normal", "High", "Urgent"]);
const status = z.enum([
    "Open",
    "InProgress",
    "WaitingForMerchant",
    "Resolved",
    "Closed",
]);
export const createSupportTicketSchema = z.object({
    body: z.object({
        category,
        priority: priority.default("Normal"),
        subject: z.string().trim().min(3).max(160),
        description: z.string().trim().min(10).max(5000),
        orderId: z.string().trim().min(1).max(100).optional(),
    }),
});
export const supportTicketListSchema = z.object({
    query: z.object({
        status: status.optional(),
    }),
});
export const supportTicketIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});
export const createSupportMessageSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        message: z.string().trim().min(1).max(5000),
        attachmentUrl: z.string().url().optional(),
    }),
});
export const updateSupportTicketStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        status,
    }),
});
