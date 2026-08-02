import "dotenv/config";

import bcrypt from "bcrypt";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { UserRole } from "../generated/prisma/client.js";

const SALT_ROUNDS = 12;

const bootstrapAdminSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "BOOTSTRAP_ADMIN_PASSWORD phải có ít nhất 12 ký tự")
    .max(100)
    .regex(/[a-z]/, "Mật khẩu phải có chữ thường")
    .regex(/[A-Z]/, "Mật khẩu phải có chữ hoa")
    .regex(/[0-9]/, "Mật khẩu phải có chữ số"),
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().max(20).optional(),
});

const run = async () => {
  const input = bootstrapAdminSchema.parse({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME,
    phoneNumber: process.env.BOOTSTRAP_ADMIN_PHONE || undefined,
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, role: true, isActive: true },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.Admin) {
      throw new Error(
        "Email đã thuộc một tài khoản không phải Admin. Script từ chối tự nâng quyền.",
      );
    }

    if (!existingUser.isActive) {
      throw new Error(
        "Admin đã tồn tại nhưng đang bị khóa. Hãy xử lý trạng thái tài khoản riêng.",
      );
    }

    console.log(`Admin ${input.email} đã tồn tại; không thay đổi mật khẩu.`);
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber || null,
      role: UserRole.Admin,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: UserRole.Admin,
      action: "ADMIN_BOOTSTRAPPED",
      entityType: "User",
      entityId: admin.id,
      metadata: { email: admin.email },
    },
  });

  console.log(`Đã tạo Admin ${admin.email} thành công.`);
};

run()
  .catch((error: unknown) => {
    if (error instanceof z.ZodError) {
      console.error("Biến môi trường bootstrap không hợp lệ:");

      for (const issue of error.issues) {
        console.error(`- ${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      console.error(error instanceof Error ? error.message : error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
