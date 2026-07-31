import { z } from "zod";
export const foodIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Food ID không hợp lệ"),
    }),
});
export const merchantFoodsSchema = z.object({
    params: z.object({
        merchantId: z.string().uuid("Merchant ID không hợp lệ"),
    }),
    query: z.object({
        onlyAvailable: z.enum(["true", "false"]).optional(),
    }),
});
export const createFoodSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Tên món ăn không được để trống").max(150),
        description: z
            .union([z.string().trim().max(2000), z.literal(""), z.null()])
            .optional(),
        price: z.coerce
            .number()
            .positive("Giá món ăn phải lớn hơn 0")
            .max(1_000_000_000),
        imageUrl: z
            .union([
            z.string().trim().url("Image URL không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
        isAvailable: z.boolean().optional().default(true),
        categoryIds: z
            .array(z.string().uuid("Category ID không hợp lệ"))
            .min(1, "Món ăn phải có ít nhất một danh mục"),
    }),
});
export const updateFoodSchema = z.object({
    params: z.object({
        id: z.string().uuid("Food ID không hợp lệ"),
    }),
    body: z
        .object({
        name: z.string().trim().min(1).max(150).optional(),
        description: z
            .union([z.string().trim().max(2000), z.literal(""), z.null()])
            .optional(),
        price: z.coerce.number().positive().optional(),
        imageUrl: z
            .union([z.string().trim().url(), z.literal(""), z.null()])
            .optional(),
        isAvailable: z.boolean().optional(),
        categoryIds: z.array(z.string().uuid()).min(1).optional(),
    })
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải cung cấp ít nhất một trường",
    }),
});
export const updateAvailabilitySchema = z.object({
    params: z.object({
        id: z.string().uuid("Food ID không hợp lệ"),
    }),
    body: z.object({
        isAvailable: z.boolean(),
    }),
});
