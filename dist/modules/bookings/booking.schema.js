import { z } from "zod";
export const createBookingSchema = z.object({
    body: z.object({
        merchantId: z.string().uuid("merchantId không hợp lệ"),
        bookingAt: z.coerce.date(),
        partySize: z.number().int().min(1, "Số khách tối thiểu là 1").max(20, "Số khách tối đa là 20"),
        note: z.string().trim().max(500, "Ghi chú không quá 500 ký tự").optional(),
    }),
});
export const reviewBookingSchema = z.object({
    body: z.object({
        status: z.enum(["Accepted", "Rejected"]),
        rejectionReason: z.string().trim().max(500).optional(),
    }),
});
