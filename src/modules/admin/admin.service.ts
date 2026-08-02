import bcrypt from "bcrypt";

import { UserRole } from "../../generated/prisma/enums.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  CreateStaffInput,
  MerchantRevenueListQuery,
  RevenuePeriodType,
} from "./admin.types.js";
import {
  ApplicationStatus,
  OrderPaymentStatus,
  OrderStatus,
  ReviewerApplicationStatus,
} from "../../generated/prisma/client.js";

import { env } from "../../config/env.js";
const SALT_ROUNDS = 12;

const staffSelect = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const mapStaff = (staff: {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: staff.id,
  userId: staff.id,

  name: staff.fullName,
  fullName: staff.fullName,

  email: staff.email,
  phoneNumber: staff.phoneNumber,
  avatarUrl: staff.avatarUrl,

  role: staff.role,
  isActive: staff.isActive,

  /*
   * Dự án không có model Staff riêng,
   * nên dùng ngày tạo tài khoản làm hiredAt.
   */
  hiredAt: staff.createdAt,
  createdAt: staff.createdAt,
  updatedAt: staff.updatedAt,
});

const getVietnamTodayRange = () => {
  const now = new Date();

  const vietnamNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  const year = vietnamNow.getUTCFullYear();
  const month = vietnamNow.getUTCMonth();
  const day = vietnamNow.getUTCDate();

  return {
    startDate: new Date(Date.UTC(year, month, day, -7, 0, 0, 0)),

    endDate: new Date(Date.UTC(year, month, day + 1, -7, 0, 0, 0)),
  };
};

const roundMoney = (value: number): number => {
  return Number(value.toFixed(2));
};

const calculateFinancialSummary = (
  orders: Array<{
    finalPrice: unknown;
    reviewerCommission: unknown;
  }>,
) => {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.finalPrice),
    0,
  );

  const reviewerFee = orders.reduce(
    (sum, order) => sum + Number(order.reviewerCommission),
    0,
  );

  const platformFee = roundMoney(
    totalRevenue * (env.PLATFORM_FEE_PERCENT / 100),
  );

  const merchantReceive = roundMoney(
    Math.max(totalRevenue - platformFee - reviewerFee, 0),
  );

  const averageOrderValue =
    orders.length > 0 ? roundMoney(totalRevenue / orders.length) : 0;

  return {
    totalRevenue: roundMoney(totalRevenue),
    platformFee,
    reviewerFee: roundMoney(reviewerFee),
    merchantReceive,
    averageOrderValue,
  };
};

const getMonthRanges = () => {
  const now = new Date();

  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  return {
    previousMonthStart,
    currentMonthStart,
    nextMonthStart,
  };
};

const calculateRevenueGrowth = (
  currentRevenue: number,
  previousRevenue: number,
): number => {
  if (previousRevenue === 0) {
    return currentRevenue > 0 ? 100 : 0;
  }

  return roundMoney(
    ((currentRevenue - previousRevenue) / previousRevenue) * 100,
  );
};

const getPeriodStart = (date: Date, periodType: RevenuePeriodType): Date => {
  switch (periodType) {
    case "Day":
      return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );

    case "Week": {
      const result = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );

      const day = result.getUTCDay();
      const offset = day === 0 ? 6 : day - 1;

      result.setUTCDate(result.getUTCDate() - offset);

      return result;
    }

    case "Year":
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

    case "Month":
    default:
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
};

const formatPeriod = (date: Date, periodType: RevenuePeriodType): string => {
  switch (periodType) {
    case "Day":
      return date.toISOString().slice(0, 10);

    case "Week":
      return `Week of ${date.toISOString().slice(0, 10)}`;

    case "Year":
      return String(date.getUTCFullYear());

    case "Month":
    default:
      return `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
  }
};

export const getStaffList = async () => {
  const staffMembers = await prisma.user.findMany({
    where: {
      role: UserRole.Staff,
    },

    select: staffSelect,

    orderBy: {
      createdAt: "desc",
    },
  });

  return staffMembers.map(mapStaff);
};

export const getStaffById = async (staffId: string) => {
  const staff = await prisma.user.findFirst({
    where: {
      id: staffId,
      role: UserRole.Staff,
    },

    select: staffSelect,
  });

  if (!staff) {
    throw new AppError(404, "Không tìm thấy Staff");
  }

  return mapStaff(staff);
};

export const createStaff = async (input: CreateStaffInput) => {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },

    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new AppError(409, "Email đã được sử dụng");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const staff = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,

      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),

      role: UserRole.Staff,
      isActive: true,
    },

    select: staffSelect,
  });

  return mapStaff(staff);
};

export const deactivateStaff = async (staffId: string) => {
  const staff = await prisma.user.findFirst({
    where: {
      id: staffId,
      role: UserRole.Staff,
    },

    select: {
      id: true,
      isActive: true,
    },
  });

  if (!staff) {
    throw new AppError(404, "Không tìm thấy Staff");
  }

  if (!staff.isActive) {
    return null;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: staff.id,
      },

      data: {
        isActive: false,
      },
    }),

    /*
     * Thu hồi phiên đăng nhập của Staff vừa bị khóa.
     */
    prisma.refreshToken.updateMany({
      where: {
        userId: staff.id,
        revokedAt: null,
      },

      data: {
        revokedAt: new Date(),
      },
    }),
  ]);

  return null;
};

export const getAdminDashboard = async () => {
  const { startDate, endDate } = getVietnamTodayRange();

  const [
    totalUsers,
    totalMerchants,
    totalOrders,
    completedPaidOrders,
    newUsersToday,
    pendingApplications,
    pendingReviewerApplications,
  ] = await prisma.$transaction([
    prisma.user.count(),

    prisma.merchant.count(),

    prisma.order.count(),

    prisma.order.findMany({
      where: {
        status: OrderStatus.Completed,

        paymentStatus: OrderPaymentStatus.Paid,
      },

      select: {
        finalPrice: true,
        reviewerCommission: true,
      },
    }),

    prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    }),

    prisma.application.count({
      where: {
        status: ApplicationStatus.Pending,
      },
    }),

    prisma.reviewerApplication.count({
      where: {
        status: ReviewerApplicationStatus.Pending,
      },
    }),
  ]);

  const totalCompletedOrders = completedPaidOrders.length;

  const totalRevenue = completedPaidOrders.reduce(
    (total, order) => total + Number(order.finalPrice),
    0,
  );

  const totalReviewerFee = completedPaidOrders.reduce(
    (total, order) => total + Number(order.reviewerCommission),
    0,
  );

  const totalPlatformFee = Number(
    (totalRevenue * (env.PLATFORM_FEE_PERCENT / 100)).toFixed(2),
  );

  const averageOrderValue =
    totalCompletedOrders > 0
      ? Number((totalRevenue / totalCompletedOrders).toFixed(2))
      : 0;

  return {
    totalUsers,
    totalMerchants,

    totalOrders,
    totalCompletedOrders,

    totalRevenue,
    totalPlatformFee,
    totalReviewerFee,
    averageOrderValue,

    newUsersToday,

    pendingApplications,
    pendingReviewerApplications,
  };
};

export const getMerchantRevenues = async (query: MerchantRevenueListQuery) => {
  const pageIndex = query.pageIndex;
  const pageSize = query.pageSize;

  const skip = (pageIndex - 1) * pageSize;

  const searchTerm = query.searchTerm?.trim() || undefined;

  const { previousMonthStart, currentMonthStart, nextMonthStart } =
    getMonthRanges();

  const merchants = await prisma.merchant.findMany({
    where: searchTerm
      ? {
          name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        }
      : undefined,

    select: {
      id: true,
      name: true,
      logoUrl: true,

      orders: {
        where: {
          OR: [
            {
              status: OrderStatus.Completed,
              paymentStatus: OrderPaymentStatus.Paid,
            },
            {
              orderedAt: {
                gte: previousMonthStart,
                lt: nextMonthStart,
              },
            },
          ],
        },

        select: {
          status: true,
          paymentStatus: true,

          finalPrice: true,
          reviewerCommission: true,

          orderedAt: true,
          completedAt: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    skip,
    take: pageSize,
  });

  return merchants.map((merchant) => {
    const completedPaidOrders = merchant.orders.filter(
      (order) =>
        order.status === OrderStatus.Completed &&
        order.paymentStatus === OrderPaymentStatus.Paid,
    );

    const financial = calculateFinancialSummary(completedPaidOrders);

    const currentMonthRevenue = completedPaidOrders
      .filter((order) => {
        const revenueDate = order.completedAt ?? order.orderedAt;

        return revenueDate >= currentMonthStart && revenueDate < nextMonthStart;
      })
      .reduce((sum, order) => sum + Number(order.finalPrice), 0);

    const previousMonthRevenue = completedPaidOrders
      .filter((order) => {
        const revenueDate = order.completedAt ?? order.orderedAt;

        return (
          revenueDate >= previousMonthStart && revenueDate < currentMonthStart
        );
      })
      .reduce((sum, order) => sum + Number(order.finalPrice), 0);

    const lastOrderAt =
      completedPaidOrders
        .map((order) => order.completedAt ?? order.orderedAt)
        .sort((first, second) => second.getTime() - first.getTime())[0] ?? null;

    return {
      merchantId: merchant.id,
      merchantName: merchant.name,
      logoUrl: merchant.logoUrl,

      completedOrders: completedPaidOrders.length,

      ...financial,

      lastOrderAt,

      revenueGrowth: calculateRevenueGrowth(
        currentMonthRevenue,
        previousMonthRevenue,
      ),
    };
  });
};

export const getMerchantRevenueDetail = async (
  merchantId: string,
  periodType: RevenuePeriodType,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
      logoUrl: true,

      orders: {
        select: {
          id: true,
          customerId: true,

          status: true,
          paymentStatus: true,

          finalPrice: true,
          reviewerCommission: true,

          orderedAt: true,
          completedAt: true,

          details: {
            select: {
              foodId: true,
              foodNameSnapshot: true,
              quantity: true,
              lineTotal: true,
            },
          },
        },
      },
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const completedPaidOrders = merchant.orders.filter(
    (order) =>
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid,
  );

  const financial = calculateFinancialSummary(completedPaidOrders);

  const pendingOrders = merchant.orders.filter(
    (order) => order.status === OrderStatus.Pending,
  ).length;

  const acceptedOrders = merchant.orders.filter(
    (order) =>
      order.status === OrderStatus.Accepted ||
      order.status === OrderStatus.Preparing ||
      order.status === OrderStatus.Ready ||
      order.status === OrderStatus.Delivering,
  ).length;

  const rejectedOrders = merchant.orders.filter(
    (order) => order.status === OrderStatus.Rejected,
  ).length;

  const completedOrders = completedPaidOrders.length;

  const cancelledOrders = merchant.orders.filter(
    (order) =>
      order.status === OrderStatus.Cancelled ||
      order.status === OrderStatus.Rejected,
  ).length;

  const cancellationRate =
    merchant.orders.length > 0
      ? roundMoney((cancelledOrders / merchant.orders.length) * 100)
      : 0;

  const totalUniqueCustomers = new Set(
    completedPaidOrders.map((order) => order.customerId),
  ).size;

  const lastOrderAt =
    completedPaidOrders
      .map((order) => order.completedAt ?? order.orderedAt)
      .sort((first, second) => second.getTime() - first.getTime())[0] ?? null;

  const revenueByPeriod = new Map<
    string,
    {
      period: string;
      periodType: RevenuePeriodType;
      revenue: number;
      orderCount: number;
    }
  >();

  for (const order of completedPaidOrders) {
    const revenueDate = order.completedAt ?? order.orderedAt;

    const periodStart = getPeriodStart(revenueDate, periodType);

    const period = formatPeriod(periodStart, periodType);

    const existing = revenueByPeriod.get(period);

    if (existing) {
      existing.revenue += Number(order.finalPrice);

      existing.orderCount += 1;
    } else {
      revenueByPeriod.set(period, {
        period,
        periodType,
        revenue: Number(order.finalPrice),
        orderCount: 1,
      });
    }
  }

  const revenueChart = Array.from(revenueByPeriod.values())
    .map((item) => ({
      ...item,
      revenue: roundMoney(item.revenue),
    }))
    .sort((first, second) => first.period.localeCompare(second.period));

  const foodStatistics = new Map<
    string,
    {
      foodId: string;
      foodName: string;
      totalSold: number;
      totalRevenue: number;
    }
  >();

  for (const order of completedPaidOrders) {
    for (const detail of order.details) {
      const existing = foodStatistics.get(detail.foodId);

      if (existing) {
        existing.totalSold += detail.quantity;

        existing.totalRevenue += Number(detail.lineTotal);
      } else {
        foodStatistics.set(detail.foodId, {
          foodId: detail.foodId,
          foodName: detail.foodNameSnapshot,
          totalSold: detail.quantity,
          totalRevenue: Number(detail.lineTotal),
        });
      }
    }
  }

  const topFoods = Array.from(foodStatistics.values())
    .map((food) => ({
      ...food,
      totalRevenue: roundMoney(food.totalRevenue),
    }))
    .sort((first, second) => second.totalSold - first.totalSold)
    .slice(0, 10);

  return {
    merchantId: merchant.id,
    merchantName: merchant.name,
    logoUrl: merchant.logoUrl,

    ...financial,

    pendingOrders,
    acceptedOrders,
    rejectedOrders,
    completedOrders,

    cancellationRate,
    totalUniqueCustomers,
    lastOrderAt,

    revenueChart,
    topFoods,
  };
};
