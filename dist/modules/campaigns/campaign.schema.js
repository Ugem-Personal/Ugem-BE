import { z } from "zod";
export const campaignIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Campaign ID is invalid"),
    }),
});
export const merchantCampaignSchema = z.object({
    params: z.object({
        merchantId: z.string().uuid("Merchant ID is invalid"),
    }),
});
const nullablePositiveNumberSchema = z
    .union([z.coerce.number().positive(), z.literal(""), z.null()])
    .optional();
const campaignCompatibilityBodySchema = z.object({
    name: z.string().trim().min(2).max(200).optional(),
    title: z
        .string()
        .trim()
        .min(2, "Tên Campaign phải có ít nhất 2 ký tự")
        .max(200)
        .optional(),
    code: z.string().trim().min(1).max(100).optional(),
    description: z
        .union([z.string().trim().max(3000), z.literal(""), z.null()])
        .optional(),
    discountType: z.enum(["Percentage", "FixedAmount"]).optional(),
    isPercentage: z.boolean().optional(),
    discountValue: z.coerce.number().positive("Giá trị giảm phải lớn hơn 0"),
    minimumOrderAmount: z.coerce.number().min(0).optional(),
    minOrderAmount: z.coerce.number().min(0).optional(),
    maximumDiscount: nullablePositiveNumberSchema,
    maxDiscountAmount: nullablePositiveNumberSchema,
    usageLimit: z
        .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
        .optional(),
    quantity: z
        .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
        .optional(),
    maxUsagePerUser: z.coerce.number().int().positive().optional(),
    isGlobal: z.boolean().optional(),
    isNewUserOnly: z.boolean().optional(),
    startAt: z.string().datetime().optional(),
    startDate: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
});
const normalizeCreateCampaignBody = (body) => ({
    ...body,
    name: body.name ?? body.title,
    discountType: body.discountType ??
        (body.isPercentage === true ? "Percentage" : "FixedAmount"),
    minimumOrderAmount: body.minimumOrderAmount ?? body.minOrderAmount ?? 0,
    maximumDiscount: body.maximumDiscount !== undefined
        ? body.maximumDiscount
        : body.maxDiscountAmount,
    usageLimit: body.usageLimit !== undefined ? body.usageLimit : body.quantity,
    startAt: body.startAt ?? body.startDate,
    endAt: body.endAt ?? body.endDate,
});
const normalizeUpdateCampaignBody = (body) => ({
    ...body,
    name: body.name ?? body.title,
    discountType: body.discountType ??
        (body.isPercentage === true
            ? "Percentage"
            : body.isPercentage === false
                ? "FixedAmount"
                : undefined),
    minimumOrderAmount: body.minimumOrderAmount ?? body.minOrderAmount,
    maximumDiscount: body.maximumDiscount !== undefined
        ? body.maximumDiscount
        : body.maxDiscountAmount,
    usageLimit: body.usageLimit !== undefined ? body.usageLimit : body.quantity,
    startAt: body.startAt ?? body.startDate,
    endAt: body.endAt ?? body.endDate,
});
const validateNormalizedCampaign = (body, context) => {
    if (!body.name?.trim()) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["title"],
            message: "Tên Campaign không được để trống",
        });
    }
    if (!body.startAt) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["startDate"],
            message: "Thời gian bắt đầu không được để trống",
        });
    }
    if (!body.endAt) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endDate"],
            message: "Thời gian kết thúc không được để trống",
        });
    }
    if (body.startAt && body.endAt) {
        if (new Date(body.endAt) <= new Date(body.startAt)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "Thời gian kết thúc phải sau thời gian bắt đầu",
            });
        }
    }
    if (body.discountType === "Percentage" && Number(body.discountValue) > 100) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["discountValue"],
            message: "Giảm theo phần trăm không được vượt quá 100%",
        });
    }
};
export const createCampaignSchema = z.object({
    body: campaignCompatibilityBodySchema
        .superRefine((body, context) => {
        validateNormalizedCampaign(normalizeCreateCampaignBody(body), context);
    })
        .transform(normalizeCreateCampaignBody),
});
export const updateCampaignSchema = z.object({
    params: z.object({
        id: z.string().uuid("Campaign ID không hợp lệ"),
    }),
    body: campaignCompatibilityBodySchema
        .partial()
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải có ít nhất một trường để cập nhật",
    })
        .transform(normalizeUpdateCampaignBody),
});
export const updateCampaignByBodySchema = z.object({
    body: campaignCompatibilityBodySchema
        .partial()
        .extend({
        id: z.string().uuid("Campaign ID không hợp lệ"),
    })
        .superRefine((body, context) => {
        if (Object.keys(body).length <= 1) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Phải có ít nhất một trường để cập nhật",
            });
        }
        const normalized = normalizeUpdateCampaignBody(body);
        if (normalized.startAt &&
            normalized.endAt &&
            new Date(normalized.endAt) <= new Date(normalized.startAt)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "Thời gian kết thúc phải sau thời gian bắt đầu",
            });
        }
        if (normalized.discountType === "Percentage" &&
            normalized.discountValue !== undefined &&
            Number(normalized.discountValue) > 100) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["discountValue"],
                message: "Giảm theo phần trăm không được vượt quá 100%",
            });
        }
    })
        .transform((body) => ({
        ...normalizeUpdateCampaignBody(body),
        id: body.id,
    })),
});
