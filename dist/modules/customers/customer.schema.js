import { z } from "zod";
const searchLimitSchema = z.coerce.number().int().min(1).max(50).default(10);
export const searchCustomersByEmailSchema = z.object({
    query: z.object({
        email: z
            .string()
            .trim()
            .min(1, "Email không được để trống")
            .max(254, "Email không được vượt quá 254 ký tự"),
        limit: searchLimitSchema,
    }),
});
export const searchCustomersByPhoneNumberSchema = z.object({
    query: z.object({
        phoneNumber: z
            .string()
            .trim()
            .min(1, "Số điện thoại không được để trống")
            .max(20, "Số điện thoại không được vượt quá 20 ký tự"),
        limit: searchLimitSchema,
    }),
});
