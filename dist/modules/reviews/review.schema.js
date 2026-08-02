import { z } from "zod";
export const reviewIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Review ID không hợp lệ"),
    }),
});
export const merchantReviewsSchema = z.object({
    params: z.object({
        merchantId: z.string().uuid("Merchant ID không hợp lệ"),
    }),
    query: z.object({
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
const reviewDetailSchema = z
    .object({
    orderDetailId: z.string().uuid("Order Detail ID không hợp lệ"),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    content: z
        .union([z.string().trim().max(1000), z.literal(""), z.null()])
        .optional(),
})
    .transform((detail) => ({
    orderDetailId: detail.orderDetailId,
    rating: detail.rating,
    content: detail.content,
}));
const updateReviewBodySchema = z
    .object({
    reviewId: z.string().uuid("Review ID không hợp lệ").optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    content: z
        .union([z.string().trim().max(3000), z.literal(""), z.null()])
        .optional(),
    imageUrl: z
        .union([z.string().trim().url(), z.literal(""), z.null()])
        .optional(),
    details: z
        .array(z.object({
        reviewDetailId: z.string().uuid("Review Detail ID không hợp lệ"),
        rating: z.coerce.number().int().min(1).max(5).optional(),
        content: z
            .union([z.string().trim().max(1000), z.literal(""), z.null()])
            .optional(),
    }))
        .max(100)
        .optional(),
})
    .refine((body) => body.rating !== undefined ||
    body.content !== undefined ||
    body.imageUrl !== undefined ||
    body.details !== undefined, {
    message: "Phải cung cấp ít nhất một trường để cập nhật",
});
export const updateReviewByBodySchema = z.object({
    body: updateReviewBodySchema.safeExtend({
        reviewId: z.string().uuid("Review ID không hợp lệ"),
    }),
});
export const createReviewSchema = z.object({
    body: z
        .object({
        /*
         * FE gửi merchantId, nhưng BE không được tin field này.
         * Merchant thật sẽ được lấy từ Order.
         */
        merchantId: z.string().uuid("Merchant ID không hợp lệ").optional(),
        orderId: z.string().uuid("Order ID không hợp lệ"),
        rating: z.coerce
            .number()
            .int()
            .min(1, "Rating tối thiểu là 1")
            .max(5, "Rating tối đa là 5"),
        content: z
            .union([z.string().trim().max(3000), z.literal(""), z.null()])
            .optional(),
        imageUrl: z
            .union([
            z.string().trim().url("Image URL không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
        details: z.array(reviewDetailSchema).max(100).optional(),
    })
        .transform((body) => ({
        orderId: body.orderId,
        merchantId: body.merchantId,
        rating: body.rating,
        content: body.content,
        imageUrl: body.imageUrl,
        details: body.details ?? [],
    })),
});
export const updateReviewSchema = z.object({
    params: z.object({
        id: z.string().uuid("Review ID không hợp lệ"),
    }),
    body: z
        .object({
        rating: z.coerce.number().int().min(1).max(5).optional(),
        content: z
            .union([z.string().trim().max(3000), z.literal(""), z.null()])
            .optional(),
        imageUrl: z
            .union([z.string().trim().url(), z.literal(""), z.null()])
            .optional(),
    })
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải cung cấp ít nhất một trường",
    }),
});
export const merchantReviewsByQuerySchema = z.object({
    query: z.object({
        merchantId: z.string().uuid("Merchant ID không hợp lệ"),
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(100),
    }),
});
export const reviewDetailsQuerySchema = z.object({
    query: z.object({
        reviewId: z.string().uuid("Review ID không hợp lệ"),
    }),
});
