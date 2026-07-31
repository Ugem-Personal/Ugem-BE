import { z } from "zod";
export const categoryIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Category ID không hợp lệ"),
    }),
});
export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Tên danh mục không được để trống").max(100),
        description: z
            .union([z.string().trim().max(500), z.literal(""), z.null()])
            .optional(),
        parentId: z
            .union([
            z.string().uuid("Parent ID không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
    }),
});
export const updateCategorySchema = z.object({
    params: z.object({
        id: z.string().uuid("Category ID không hợp lệ"),
    }),
    body: z
        .object({
        name: z.string().trim().min(1).max(100).optional(),
        description: z
            .union([z.string().trim().max(500), z.literal(""), z.null()])
            .optional(),
        parentId: z
            .union([z.string().uuid(), z.literal(""), z.null()])
            .optional(),
        isActive: z.boolean().optional(),
    })
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải cung cấp ít nhất một trường",
    }),
});
export const parentCategoryIdSchema = z.object({
    params: z.object({
        parentId: z.string().uuid("Parent Category ID không hợp lệ"),
    }),
});
