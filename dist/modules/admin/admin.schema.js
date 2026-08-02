import { z } from "zod";
export const createStaffSchema = z.object({
    body: z.object({
        email: z
            .string()
            .trim()
            .email("Email không hợp lệ")
            .max(254)
            .transform((value) => value.toLowerCase()),
        fullName: z
            .string()
            .trim()
            .min(2, "Họ tên phải có ít nhất 2 ký tự")
            .max(150),
        password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(100),
        phoneNumber: z
            .string()
            .trim()
            .regex(/^[0-9+()\-\s]{8,20}$/, "Số điện thoại không hợp lệ"),
    }),
});
export const staffIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Staff ID không hợp lệ"),
    }),
});
const positiveIntegerSchema = z.coerce.number().int().min(1);
export const merchantRevenueListSchema = z.object({
    query: z.object({
        searchTerm: z.string().trim().max(200).optional(),
        pageIndex: positiveIntegerSchema.default(1),
        pageSize: positiveIntegerSchema.max(100).default(10),
    }),
});
export const merchantRevenueDetailSchema = z.object({
    params: z.object({
        merchantId: z.string().uuid("Merchant ID không hợp lệ"),
    }),
    query: z.object({
        periodType: z.enum(["Day", "Week", "Month", "Year"]).default("Month"),
    }),
});
export const auditLogListSchema = z.object({
    query: z.object({
        search: z.string().trim().max(200).optional(),
        action: z.string().trim().max(100).optional(),
        entityType: z.string().trim().max(100).optional(),
        pageIndex: positiveIntegerSchema.default(1),
        pageSize: positiveIntegerSchema.max(100).default(20),
    }),
});
