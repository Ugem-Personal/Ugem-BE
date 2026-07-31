import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Email không hợp lệ")
      .transform((value) => value.toLowerCase()),

    password: z
      .string()
      .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
      .max(100, "Mật khẩu không được vượt quá 100 ký tự"),

    phoneNumber: z.string().trim().optional().or(z.literal("")),

    fullName: z
      .string()
      .trim()
      .min(2, "Họ tên phải có ít nhất 2 ký tự")
      .max(100, "Họ tên không được vượt quá 100 ký tự"),

    avatarUrl: z.string().trim().optional().or(z.literal("")),

    role: z.enum(["Customer", "Merchant"]).default("Customer"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Email không hợp lệ")
      .transform((value) => value.toLowerCase()),

    password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    /*
     * FE hiện gửi accessToken kèm theo.
     * BE không cần tin hoặc giải mã accessToken cũ,
     * nhưng vẫn nhận để khớp contract.
     */
    accessToken: z.string().optional(),

    refreshToken: z.string().min(1, "Refresh token không được để trống"),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    idToken: z.string().trim().min(1, "Google ID token không được để trống"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Email không hợp lệ")
      .transform((value) => value.toLowerCase()),
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .email("Email không hợp lệ")
        .transform((value) => value.toLowerCase()),

      token: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Mã xác nhận phải gồm 6 chữ số"),

      newPassword: z
        .string()
        .min(6, "Mật khẩu mới phải có ít nhất 6 ký tự")
        .max(100, "Mật khẩu mới không được vượt quá 100 ký tự"),

      confirmNewPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmNewPassword"],
    }),
});
