import { z } from "zod";
export const updateProfileSchema = z.object({
    body: z
        .object({
        fullName: z
            .string()
            .trim()
            .min(2, "Họ tên phải có ít nhất 2 ký tự")
            .max(100, "Họ tên không được vượt quá 100 ký tự")
            .optional(),
        phoneNumber: z
            .union([
            z
                .string()
                .trim()
                .regex(/^[0-9+()\-\s]{8,20}$/, "Số điện thoại không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
        avatarUrl: z
            .union([
            z.string().trim().url("Avatar URL không hợp lệ"),
            z.literal(""),
            z.null(),
        ])
            .optional(),
    })
        .refine((body) => Object.keys(body).length > 0, {
        message: "Phải cung cấp ít nhất một trường để cập nhật",
    }),
});
