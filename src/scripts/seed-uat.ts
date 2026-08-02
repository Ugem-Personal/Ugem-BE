import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "../config/prisma.js";
import {
  CampaignDiscountType,
  MerchantStatus,
  Prisma,
  UserRole,
} from "../generated/prisma/client.js";

const DEFAULT_PASSWORD = "UGemUat12345!";
const password = process.env.UAT_SEED_PASSWORD || DEFAULT_PASSWORD;

const validatePassword = () => {
  if (
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new Error(
      "UAT_SEED_PASSWORD phải có ít nhất 12 ký tự, chữ hoa, chữ thường và chữ số",
    );
  }
};

const ensureNonProduction = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:uat từ chối chạy khi NODE_ENV=production");
  }

  const databases = await prisma.$queryRaw<
    Array<{ databaseName: string }>
  >`SELECT current_database() AS "databaseName"`;
  const databaseName = databases[0]?.databaseName;

  if (!databaseName) throw new Error("Không xác định được database hiện tại");
  return databaseName;
};

const upsertUser = async (input: {
  email: string;
  fullName: string;
  role: UserRole;
  phoneNumber: string;
  passwordHash: string;
}) =>
  prisma.user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
    },
    create: {
      email: input.email,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
    },
  });

const ensureCategory = async (name: string, description: string) => {
  const existing = await prisma.category.findFirst({
    where: { parentId: null, name },
  });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: { description, isActive: true },
    });
  }

  return prisma.category.create({
    data: { name, description, isActive: true },
  });
};

const ensureFood = async (input: {
  merchantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  toppings: Array<{ name: string; price: number }>;
}) => {
  const existing = await prisma.food.findFirst({
    where: { merchantId: input.merchantId, name: input.name },
  });

  const food = existing
    ? await prisma.food.update({
        where: { id: existing.id },
        data: {
          description: input.description,
          price: new Prisma.Decimal(input.price),
          imageUrl: input.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
          isAvailable: true,
        },
      })
    : await prisma.food.create({
        data: {
          merchantId: input.merchantId,
          name: input.name,
          description: input.description,
          price: new Prisma.Decimal(input.price),
          imageUrl: input.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
          isAvailable: true,
        },
      });

  await prisma.foodCategory.upsert({
    where: {
      foodId_categoryId: { foodId: food.id, categoryId: input.categoryId },
    },
    update: {},
    create: { foodId: food.id, categoryId: input.categoryId },
  });

  for (const topping of input.toppings) {
    await prisma.foodTopping.upsert({
      where: { foodId_name: { foodId: food.id, name: topping.name } },
      update: { price: new Prisma.Decimal(topping.price), isActive: true },
      create: {
        foodId: food.id,
        name: topping.name,
        price: new Prisma.Decimal(topping.price),
        isActive: true,
      },
    });
  }

  return food;
};

const run = async () => {
  validatePassword();
  const databaseName = await ensureNonProduction();
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await upsertUser({
    email: "admin@uat.ugem.local",
    fullName: "Admin UAT",
    role: UserRole.Admin,
    phoneNumber: "0900000001",
    passwordHash,
  });
  const staff = await upsertUser({
    email: "staff@uat.ugem.local",
    fullName: "Staff UAT",
    role: UserRole.Staff,
    phoneNumber: "0900000002",
    passwordHash,
  });
  const customerUser = await upsertUser({
    email: "customer@uat.ugem.local",
    fullName: "Customer UAT",
    role: UserRole.Customer,
    phoneNumber: "0900000003",
    passwordHash,
  });
  const reviewerUser = await upsertUser({
    email: "reviewer@uat.ugem.local",
    fullName: "Reviewer UAT",
    role: UserRole.Reviewer,
    phoneNumber: "0900000004",
    passwordHash,
  });
  const merchantUser = await upsertUser({
    email: "merchant@uat.ugem.local",
    fullName: "Merchant UAT",
    role: UserRole.Merchant,
    phoneNumber: "0900000005",
    passwordHash,
  });

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: { userId: customerUser.id },
  });
  const reviewer = await prisma.customer.upsert({
    where: { userId: reviewerUser.id },
    update: { reviewerPoints: 250, reviewerRank: "Silver" },
    create: {
      userId: reviewerUser.id,
      reviewerPoints: 250,
      reviewerRank: "Silver",
    },
  });

  const reviewerPointSeed = await prisma.reviewerPointTransaction.findFirst({
    where: { reviewerId: reviewer.id, referenceId: "uat-seed" },
  });
  if (!reviewerPointSeed) {
    await prisma.reviewerPointTransaction.create({
      data: {
        reviewerId: reviewer.id,
        amount: 250,
        pointsAfter: 250,
        type: "UAT_SEED",
        reason: "Dữ liệu reviewer mẫu cho local UAT",
        referenceId: "uat-seed",
      },
    });
  }

  // Update existing merchants without images to have real Unsplash image URLs
  await prisma.merchant.updateMany({
    where: { OR: [{ logoUrl: null }, { logoUrl: "" }] },
    data: {
      logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    },
  });

  const merchant = await prisma.merchant.upsert({
    where: { userId: merchantUser.id },
    update: {
      name: "Bếp Nhà UAT",
      description: "Merchant mẫu phục vụ kiểm thử chấp nhận người dùng.",
      logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
      status: MerchantStatus.Active,
      latitude: new Prisma.Decimal("10.7768890"),
      longitude: new Prisma.Decimal("106.7008060"),
    },
    create: {
      userId: merchantUser.id,
      name: "Bếp Nhà UAT",
      description: "Merchant mẫu phục vụ kiểm thử chấp nhận người dùng.",
      restaurantType: "Nhà hàng",
      mainDishType: "Món Việt",
      priceRange: "50000-200000",
      email: merchantUser.email,
      phone: "0900000005",
      address: "1 Nguyễn Huệ, Quận 1, TP.HCM",
      openingHours: "07:00-22:00",
      logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
      latitude: new Prisma.Decimal("10.7768890"),
      longitude: new Prisma.Decimal("106.7008060"),
      status: MerchantStatus.Active,
    },
  });

  const category = await ensureCategory(
    "Món Việt UAT",
    "Danh mục dữ liệu mẫu dành cho UAT.",
  );
  const food = await ensureFood({
    merchantId: merchant.id,
    categoryId: category.id,
    name: "Cơm tấm UAT",
    description: "Món mẫu để kiểm tra giỏ hàng và vòng đời đơn hàng.",
    price: 65000,
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    toppings: [
      { name: "Trứng ốp la UAT", price: 12000 },
      { name: "Bì thêm UAT", price: 15000 },
    ],
  });

  // Update existing foods without images
  await prisma.food.updateMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: "" }] },
    data: {
      imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    },
  });

  await prisma.campaign.upsert({
    where: { code: "UAT10" },
    update: {
      merchantId: merchant.id,
      isActive: true,
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      endAt: new Date("2030-12-31T23:59:59.000Z"),
    },
    create: {
      merchantId: merchant.id,
      name: "Giảm 10% UAT",
      description: "Campaign mẫu cho kiểm thử local.",
      code: "UAT10",
      discountType: CampaignDiscountType.Percentage,
      discountValue: new Prisma.Decimal(10),
      minimumOrderAmount: new Prisma.Decimal(50000),
      maximumDiscount: new Prisma.Decimal(30000),
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      endAt: new Date("2030-12-31T23:59:59.000Z"),
      usageLimit: 1000,
      maxUsagePerUser: 10,
      isGlobal: false,
      isNewUserOnly: false,
      isActive: true,
    },
  });

  console.log(`UAT seed hoàn tất trên database '${databaseName}'.`);
  console.table([
    { role: "Admin", email: admin.email },
    { role: "Staff", email: staff.email },
    { role: "Customer", email: customerUser.email },
    { role: "Reviewer", email: reviewerUser.email },
    { role: "Merchant", email: merchantUser.email },
  ]);
  console.log(`Password: ${process.env.UAT_SEED_PASSWORD ? "giá trị UAT_SEED_PASSWORD" : DEFAULT_PASSWORD}`);
  console.log(`customerId=${customer.id}`);
  console.log(`reviewerId=${reviewer.id}`);
  console.log(`merchantId=${merchant.id}`);
  console.log(`foodId=${food.id}`);
};

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
