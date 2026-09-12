import { z } from "zod";
export const orderIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Order ID không hợp lệ"),
    }),
});
const orderFoodSchema = z.object({
    foodId: z.string().uuid("Food ID không hợp lệ"),
    quantity: z.coerce.number().int().min(1, "Số lượng phải lớn hơn 0").max(100),
    notes: z
        .union([z.string().trim().max(500), z.literal(""), z.null()])
        .optional(),
    foodToppingIds: z
        .array(z.string().uuid("Topping ID không hợp lệ"))
        .optional()
        .default([]),
});
export const createOrderSchema = z.object({
    body: z
        .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên người nhận không được để trống")
            .max(100),
        paymentMethod: z.enum(["COD", "Cash", "BankTransfer", "SePay"]),
        notes: z
            .union([z.string().trim().max(1000), z.literal(""), z.null()])
            .optional(),
        deliveryAddress: z
            .union([z.string().trim().max(500), z.literal(""), z.null()])
            .optional(),
        deliveryLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
        deliveryLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
        orderType: z.enum(["Online", "Offline"]),
        finalPrice: z.coerce.number().nonnegative().optional(),
        affiliateLinkCode: z
            .union([z.string().trim().max(100), z.literal(""), z.null()])
            .optional(),
        campaignId: z
            .union([
            z.string().uuid("Campaign ID không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
        pointsToRedeem: z.coerce.number().int().min(0).optional().default(0),
        foods: z
            .array(orderFoodSchema)
            .min(1, "Order phải có ít nhất một món")
            .max(100),
    })
        .superRefine((body, context) => {
        if (body.orderType === "Online" && !body.deliveryAddress?.trim()) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["deliveryAddress"],
                message: "Order Online phải có địa chỉ giao hàng",
            });
        }
        if (body.orderType === "Online" &&
            (body.deliveryLatitude == null || body.deliveryLongitude == null)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["deliveryLatitude"],
                message: "Order Online phải có vị trí giao hàng trên bản đồ",
            });
        }
    }),
});
export const updateOrderStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("Order ID không hợp lệ"),
    }),
    body: z
        .object({
        status: z.enum([
            "Accepted",
            "Preparing",
            "Ready",
            "Delivering",
            "Rejected",
        ]),
        rejectionReason: z
            .union([z.string().trim().max(1000), z.literal(""), z.null()])
            .optional(),
    })
        .superRefine((body, context) => {
        if (body.status === "Rejected" && !body.rejectionReason?.trim()) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["rejectionReason"],
                message: "Phải nhập lý do khi từ chối order",
            });
        }
    }),
});
export const orderListSchema = z.object({
    query: z.object({
        status: z
            .enum([
            "Pending",
            "Accepted",
            "Preparing",
            "Ready",
            "Delivering",
            "Rejected",
            "Completed",
            "NotReceived",
            "Cancelled",
        ])
            .optional(),
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
export const createMerchantOrderSchema = z.object({
    body: createOrderSchema.shape.body.extend({
        customerId: z.string().uuid("Customer ID không hợp lệ"),
    }),
});
export const orderIdParamSchema = z.object({
    params: z.object({
        orderId: z.string().uuid("Order ID không hợp lệ"),
    }),
});
export const rejectMerchantOrderSchema = z.object({
    body: z.object({
        orderId: z.string().uuid("Order ID không hợp lệ"),
        reason: z
            .string()
            .trim()
            .min(1, "Lý do từ chối không được để trống")
            .max(1000, "Lý do từ chối không được vượt quá 1000 ký tự"),
    }),
});
export const customerUpdateOrderStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("Order ID không hợp lệ"),
    }),
    body: z.object({
        status: z.enum(["Completed", "NotReceived"]),
    }),
});
export const updateOrderStatusByRoleSchema = z.object({
    params: z.object({
        id: z.string().uuid("Order ID không hợp lệ"),
    }),
    body: z
        .object({
        status: z.enum([
            "Accepted",
            "Preparing",
            "Ready",
            "Delivering",
            "Rejected",
            "Completed",
            "NotReceived",
        ]),
        rejectionReason: z
            .union([z.string().trim().max(1000), z.literal(""), z.null()])
            .optional(),
        reason: z
            .union([z.string().trim().max(1000), z.literal(""), z.null()])
            .optional(),
    })
        .superRefine((body, context) => {
        if (body.status === "Rejected" &&
            !body.rejectionReason?.trim() &&
            !body.reason?.trim()) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["rejectionReason"],
                message: "Phải nhập lý do khi từ chối order",
            });
        }
    }),
});
