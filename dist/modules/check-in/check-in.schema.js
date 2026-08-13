import { z } from "zod";
const orderIdSchema = z.string().uuid("Order ID không hợp lệ");
export const generateCheckInQrSchema = z.object({
    query: z.object({
        orderId: orderIdSchema,
    }),
});
export const verifyCheckInSchema = z.object({
    body: z.object({
        orderId: orderIdSchema,
        checkInToken: z.string().min(32).max(500),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
    }),
});
