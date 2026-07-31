import { z } from "zod";

export const foodToppingIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Topping ID không hợp lệ"),
  }),
});

export const foodIdParamSchema = z.object({
  params: z.object({
    foodId: z.string().uuid("Food ID không hợp lệ"),
  }),
});

export const createFoodToppingSchema = z.object({
  body: z.object({
    foodId: z.string().uuid("Food ID không hợp lệ"),

    name: z.string().trim().min(1, "Tên topping không được để trống").max(100),

    price: z.coerce.number().min(0, "Giá topping không được âm"),

    isActive: z.boolean().optional().default(true),
  }),
});

export const updateFoodToppingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Topping ID không hợp lệ"),
  }),

  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      price: z.coerce.number().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "Phải cung cấp ít nhất một trường",
    }),
});

export const updateFoodToppingByBodySchema = z.object({
  body: z
    .object({
      foodToppingId: z.string().uuid("Topping ID không hợp lệ"),

      name: z
        .string()
        .trim()
        .min(1, "Tên topping không được để trống")
        .max(100)
        .optional(),

      price: z.coerce.number().min(0, "Giá topping không được âm").optional(),

      isActive: z.boolean().optional(),
    })
    .refine(
      (body) =>
        body.name !== undefined ||
        body.price !== undefined ||
        body.isActive !== undefined,
      {
        message: "Phải cung cấp ít nhất một trường để cập nhật",
      },
    ),
});
