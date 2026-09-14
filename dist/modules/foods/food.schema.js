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
export const comboItemSchema = z.object({
    foodId: z.string().uuid("Food ID của món trong combo không hợp lệ"),
    quantity: z.coerce
        .number()
        .int()
        .min(1, "Số lượng món trong combo phải ít nhất là 1")
        .default(1),
});
export const createFoodSchema = z.object({
    body: z
        .object({
        name: z.string().trim().min(1, "Tên món ăn không được để trống").max(150),
        description: z
            .union([z.string().trim().max(2000), z.literal(""), z.null()])
            .optional(),
        cuisine: z
            .union([z.string().trim().max(100), z.literal(""), z.null()])
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
        isCombo: z.boolean().optional().default(false),
        originalPrice: z.coerce
            .number()
            .positive("Giá gốc phải lớn hơn 0")
            .max(1_000_000_000)
            .nullable()
            .optional(),
        servingSize: z
            .union([z.string().trim().max(50), z.literal(""), z.null()])
            .optional(),
        comboItems: z.array(comboItemSchema).optional(),
    })
        .refine((data) => {
        if (data.isCombo && (!data.comboItems || data.comboItems.length === 0)) {
            return false;
        }
        return true;
    }, {
        message: "Combo phải bao gồm ít nhất một món ăn thành phần",
        path: ["comboItems"],
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
        cuisine: z
            .union([z.string().trim().max(100), z.literal(""), z.null()])
            .optional(),
        price: z.coerce.number().positive().optional(),
        imageUrl: z
            .union([z.string().trim().url(), z.literal(""), z.null()])
            .optional(),
        isAvailable: z.boolean().optional(),
        categoryIds: z.array(z.string().uuid()).min(1).optional(),
        isCombo: z.boolean().optional(),
        originalPrice: z.coerce
            .number()
            .positive()
            .max(1_000_000_000)
            .nullable()
            .optional(),
        servingSize: z
            .union([z.string().trim().max(50), z.literal(""), z.null()])
            .optional(),
        comboItems: z.array(comboItemSchema).optional(),
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
