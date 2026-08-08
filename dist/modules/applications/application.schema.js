import { z } from "zod";
const nullableUrlSchema = z
    .union([z.string().trim().url("URL không hợp lệ"), z.literal(""), z.null()])
    .optional();
const menuItemSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Tên món ăn không được để trống")
        .max(150, "Tên món ăn quá dài"),
    description: z
        .union([z.string().trim().max(1000), z.literal(""), z.null()])
        .optional(),
    price: z.coerce.number().positive("Giá món ăn phải lớn hơn 0"),
    imageUrl: nullableUrlSchema,
    category: z
        .string()
        .trim()
        .min(1, "Loại món không được để trống")
        .max(100),
    cuisine: z
        .union([z.string().trim().max(100), z.literal(""), z.null()])
        .optional(),
});
export const applicationBodySchema = z.object({
    name: z.string().trim().min(2, "Tên quán phải có ít nhất 2 ký tự").max(200),
    description: z
        .union([z.string().trim().max(3000), z.literal(""), z.null()])
        .optional(),
    restaurantType: z
        .string()
        .trim()
        .min(1, "Loại nhà hàng không được để trống")
        .max(100),
    mainDishType: z
        .string()
        .trim()
        .min(1, "Món chính không được để trống")
        .max(100),
    priceRange: z
        .string()
        .trim()
        .min(1, "Khoảng giá không được để trống")
        .max(100),
    email: z
        .string()
        .trim()
        .email("Email không hợp lệ")
        .transform((value) => value.toLowerCase()),
    phone: z
        .string()
        .trim()
        .regex(/^[0-9+()\-\s]{8,20}$/, "Số điện thoại không hợp lệ"),
    logoUrl: nullableUrlSchema,
    openingHours: z
        .string()
        .trim()
        .min(1, "Giờ mở cửa không được để trống")
        .max(300),
    address: z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự").max(500),
    latitude: z
        .union([z.coerce.number().min(-90).max(90), z.literal(""), z.null()])
        .optional(),
    longitude: z
        .union([z.coerce.number().min(-180).max(180), z.literal(""), z.null()])
        .optional(),
    menu: z
        .array(menuItemSchema)
        .min(1, "Hồ sơ phải có ít nhất một món ăn")
        .max(100, "Danh sách món ăn quá lớn"),
});
export const applicationIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Application ID không hợp lệ"),
    }),
});
export const reviewApplicationSchema = z.object({
    params: z.object({
        id: z.string().uuid("Application ID không hợp lệ"),
    }),
    body: z
        .object({
        status: z.enum(["Accepted", "Rejected"]),
        rejectionReason: z
            .union([
            z.string().trim().max(1000, "Lý do từ chối quá dài"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
        /*
         * Tương thích payload hiện tại của FE.
         */
        note: z
            .union([
            z.string().trim().max(1000, "Lý do từ chối quá dài"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
    })
        .superRefine((body, context) => {
        if (body.status === "Rejected" &&
            !body.rejectionReason?.trim() &&
            !body.note?.trim()) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["rejectionReason"],
                message: "Phải nhập lý do khi từ chối hồ sơ",
            });
        }
    })
        .transform((body) => ({
        status: body.status,
        rejectionReason: body.rejectionReason?.trim() || body.note?.trim() || null,
    })),
});
export const listApplicationsSchema = z.object({
    query: z
        .object({
        status: z.enum(["Draft", "Pending", "Accepted", "Rejected"]).optional(),
        search: z.string().trim().optional(),
        pageIndex: z.coerce.number().int().min(0).default(0),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    })
        .transform((query) => ({
        ...query,
        /*
         * FE dùng pageIndex bắt đầu từ 0,
         * service BE dùng pageIndex bắt đầu từ 1.
         */
        pageIndex: query.pageIndex + 1,
    })),
});
