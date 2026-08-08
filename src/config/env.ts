import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(8080),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),

  JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  FRONTEND_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),

  CLOUDINARY_API_KEY: z.string().min(1),

  CLOUDINARY_API_SECRET: z.string().min(1),
  SEPAY_WEBHOOK_API_KEY: z.string().min(32),
  BANK_CODE: z.string().trim().min(1),
  BANK_ACCOUNT_NUMBER: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4,19}$/, "Số tài khoản ngân hàng không hợp lệ"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Environment variables không hợp lệ:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
