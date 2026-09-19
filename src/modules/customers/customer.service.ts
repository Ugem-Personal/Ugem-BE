import { prisma } from "../../config/prisma.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
  SearchCustomersByEmailQuery,
  SearchCustomersByPhoneNumberQuery,
  UpdateCustomerPreferencesInput,
} from "./customer.types.js";

const customerSelect = {
  id: true,

  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      avatarUrl: true,
      isActive: true,
    },
  },
} as const;

const mapCustomerSearchResult = (customer: {
  id: string;

  user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}) => {
  return {
    userId: customer.user.id,
    customerId: customer.id,

    fullName: customer.user.fullName,
    email: customer.user.email,
    phoneNumber: customer.user.phoneNumber,

    role: customer.user.role,
    avatarUrl: customer.user.avatarUrl,
  };
};

export const searchCustomersByEmail = async (
  query: SearchCustomersByEmailQuery,
) => {
  const normalizedEmail = query.email.trim().toLowerCase();

  const customers = await prisma.customer.findMany({
    where: {
      user: {
        isActive: true,

        role: {
          in: ["Customer", "Reviewer"],
        },

        email: {
          contains: normalizedEmail,
          mode: "insensitive",
        },
      },
    },

    select: customerSelect,

    orderBy: {
      user: {
        email: "asc",
      },
    },

    take: query.limit,
  });

  return customers.map(mapCustomerSearchResult);
};

const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/[\s().-]/g, "");
};

export const searchCustomersByPhoneNumber = async (
  query: SearchCustomersByPhoneNumberQuery,
) => {
  const normalizedPhoneNumber = normalizePhoneNumber(query.phoneNumber.trim());

  const candidates = await prisma.customer.findMany({
    where: {
      user: {
        isActive: true,

        role: {
          in: ["Customer", "Reviewer"],
        },

        phoneNumber: {
          not: null,
        },
      },
    },

    select: customerSelect,

    orderBy: {
      user: {
        phoneNumber: "asc",
      },
    },

    take: Math.max(query.limit * 10, 100),
  });

  return candidates
    .filter((customer) => {
      const phoneNumber = customer.user.phoneNumber;

      if (!phoneNumber) {
        return false;
      }

      return normalizePhoneNumber(phoneNumber).includes(normalizedPhoneNumber);
    })
    .slice(0, query.limit)
    .map(mapCustomerSearchResult);
};

export const getCustomerPreferences = async (customerId: string) => {
  return prisma.customer.findUnique({
    where: {
      id: customerId,
    },

    select: {
      preferredRestaurantTypes: true,
      preferredMainDishTypes: true,
      preferredCategoryIds: true,
      preferredPriceRanges: true,
    },
  });
};

export const updateCustomerPreferences = async (
  customerId: string,
  input: UpdateCustomerPreferencesInput,
) => {
  const preferredCategoryIds = [...new Set(input.preferredCategoryIds)];

  if (preferredCategoryIds.length > 0) {
    const validCategories = await prisma.category.count({
      where: {
        id: { in: preferredCategoryIds },
        isActive: true,
      },
    });

    if (validCategories !== preferredCategoryIds.length) {
      throw new AppError(400, "Có nhóm món yêu thích không hợp lệ");
    }
  }

  const preferences = await prisma.customer.update({
    where: {
      id: customerId,
    },

    data: {
      preferredRestaurantTypes: input.preferredRestaurantTypes,
      preferredMainDishTypes: input.preferredMainDishTypes,
      preferredCategoryIds,
      preferredPriceRanges: input.preferredPriceRanges,
    },

    select: {
      preferredRestaurantTypes: true,
      preferredMainDishTypes: true,
      preferredCategoryIds: true,
      preferredPriceRanges: true,
    },
  });

  recommendationCache.invalidateCustomer(customerId);

  return preferences;
};

export const getReviewerProfile = async (customerId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      reviewerPoints: true,
      reviewerRank: true,
      gemPoints: true,
      contributionRank: true,
      pointTransactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!customer) {
    throw new AppError(404, "Không tìm thấy thông tin khách hàng");
  }

  return {
    // Expose the independent UFind Gem balance alongside legacy Reviewer data.
    gemPoints: customer.gemPoints ?? 0,
    contributionRank: customer.contributionRank || "Bronze",
    reviewerPoints: customer.reviewerPoints ?? 0,
    reviewerRank: customer.reviewerRank || "Bronze",
    pointTransactions: customer.pointTransactions,
  };
};

export const VOUCHER_TIERS: Record<
  string,
  {
    pointsCost: number;
    discountValue: number;
    minOrderAmount: number;
    title: string;
    prefix: string;
  }
> = {
  VOUCHER_10K: {
    pointsCost: 50,
    discountValue: 10000,
    minOrderAmount: 50000,
    title: "Voucher UGem 10.000đ",
    prefix: "UGEM10K",
  },
  VOUCHER_25K: {
    pointsCost: 100,
    discountValue: 25000,
    minOrderAmount: 100000,
    title: "Voucher UGem 25.000đ",
    prefix: "UGEM25K",
  },
  VOUCHER_50K: {
    pointsCost: 200,
    discountValue: 50000,
    minOrderAmount: 200000,
    title: "Voucher UGem 50.000đ",
    prefix: "UGEM50K",
  },
  VOUCHER_100K: {
    pointsCost: 350,
    discountValue: 100000,
    minOrderAmount: 300000,
    title: "Voucher VIP UGem 100.000đ",
    prefix: "UGEM100K",
  },
};

export const redeemVoucher = async (
  customerId: string,
  voucherTier: string,
) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, reviewerPoints: true },
  });

  if (!customer) {
    throw new AppError(404, "Không tìm thấy thông tin khách hàng");
  }

  const tier = VOUCHER_TIERS[voucherTier];
  if (!tier) {
    throw new AppError(400, "Gói voucher đổi thưởng không hợp lệ");
  }

  const currentPoints = customer.reviewerPoints ?? 0;
  if (currentPoints < tier.pointsCost) {
    throw new AppError(
      400,
      `Bạn cần tối thiểu ${tier.pointsCost} điểm để đổi voucher này (điểm hiện có: ${currentPoints}).`,
    );
  }

  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const voucherCode = `${tier.prefix}-${randomSuffix}`;

  const [updatedCustomer, transaction] = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { reviewerPoints: { decrement: tier.pointsCost } },
      select: { id: true, reviewerPoints: true, reviewerRank: true },
    });

    const txRecord = await tx.reviewerPointTransaction.create({
      data: {
        reviewerId: customerId,
        amount: -tier.pointsCost,
        pointsAfter: updated.reviewerPoints,
        type: "redeem_voucher",
        reason: `Đổi ${tier.title} (Giảm ${tier.discountValue.toLocaleString("vi-VN")}đ, đơn từ ${tier.minOrderAmount.toLocaleString("vi-VN")}đ)`,
        referenceId: voucherCode,
      },
    });

    return [updated, txRecord];
  });

  return {
    voucherCode,
    voucherTier,
    title: tier.title,
    discountValue: tier.discountValue,
    minOrderAmount: tier.minOrderAmount,
    pointsCost: tier.pointsCost,
    remainingPoints: updatedCustomer.reviewerPoints,
    createdAt: transaction.createdAt,
  };
};

export const getMyRedeemedVouchers = async (customerId: string) => {
  const transactions = await prisma.reviewerPointTransaction.findMany({
    where: {
      reviewerId: customerId,
      type: "redeem_voucher",
    },
    orderBy: { createdAt: "desc" },
  });

  const usedOrders = await prisma.order.findMany({
    where: {
      customerId,
      notes: { contains: "[Voucher:" },
      status: { notIn: ["Rejected", "Cancelled"] },
    },
    select: { notes: true },
  });

  const usedCodes = new Set(
    usedOrders
      .map((o) => o.notes?.match(/\[Voucher:([^\]]+)\]/)?.[1]?.trim().toUpperCase())
      .filter(Boolean),
  );

  return transactions.map((tx) => {
    const code = tx.referenceId || "UGEM-VOUCHER";
    let discountValue = 10000;
    let minOrderAmount = 50000;
    let title = "Voucher UGem 10.000đ";

    if (code.startsWith("UGEM100K")) {
      discountValue = 100000;
      minOrderAmount = 300000;
      title = "Voucher VIP UGem 100.000đ";
    } else if (code.startsWith("UGEM50K")) {
      discountValue = 50000;
      minOrderAmount = 200000;
      title = "Voucher UGem 50.000đ";
    } else if (code.startsWith("UGEM25K")) {
      discountValue = 25000;
      minOrderAmount = 100000;
      title = "Voucher UGem 25.000đ";
    }

    return {
      id: tx.id,
      code,
      title,
      discountValue,
      minOrderAmount,
      pointsSpent: Math.abs(tx.amount),
      isUsed: usedCodes.has(code.toUpperCase()),
      createdAt: tx.createdAt,
    };
  });
};
