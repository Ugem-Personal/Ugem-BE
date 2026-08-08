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
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .max(100, "Mật khẩu không được vượt quá 100 ký tự")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số",
      ),

    phoneNumber: z
      .string()
      .trim()
      .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, "Số điện thoại không hợp lệ (Ví dụ: 0912345678)"),

    fullName: z
      .string()
      .trim()
      .min(2, "Họ tên phải có ít nhất 2 ký tự")
      .max(100, "Họ tên không được vượt quá 100 ký tự")
      .refine((val) => val.trim().split(/\s+/).filter(Boolean).length >= 2, {
        message: "Họ và tên phải bao gồm ít nhất 2 từ (Ví dụ: Nguyễn Văn A)",
      }),

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
        .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
        .max(100, "Mật khẩu mới không được vượt quá 100 ký tự")
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          "Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số",
        ),

      confirmNewPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmNewPassword"],
    }),
});

export const verifyResetCodeSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Email không hợp lệ")
      .transform((value) => value.toLowerCase()),

    token: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Mã xác nhận phải gồm 6 chữ số"),
  }),
});
