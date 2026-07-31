import {
  OrderPaymentStatus,
  OrderStatus,
} from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../common/errors/app-error.js";
import { getYearRange } from "../utils/dashboard-date.util.js";
export const getReviewerDashboard = async (reviewerId: string) => {
  const reviewer = await prisma.customer.findUnique({
    where: {
      id: reviewerId,
    },

    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  if (!reviewer) {
    throw new AppError(404, "Không tìm thấy Reviewer");
  }

  if (reviewer.user.role !== "Reviewer") {
    throw new AppError(403, "Tài khoản chưa phải Reviewer");
  }

  const [affiliateLinks, totalReviews, earningTransactions] =
    await prisma.$transaction([
      prisma.affiliateLink.findMany({
        where: {
          reviewerId,
        },

        select: {
          id: true,
          clickCount: true,
          successfulOrders: true,
          totalEarnings: true,
          isActive: true,
        },
      }),

      prisma.review.count({
        where: {
          customerId: reviewerId,
        },
      }),

      prisma.reviewerEarningTransaction.findMany({
        where: {
          reviewerId,
        },

        select: {
          amount: true,
        },
      }),
    ]);

  const totalClicks = affiliateLinks.reduce(
    (total, link) => total + link.clickCount,
    0,
  );

  const successfulOrders = affiliateLinks.reduce(
    (total, link) => total + link.successfulOrders,
    0,
  );

  const totalEarnings = earningTransactions.reduce(
    (total, transaction) => total + Number(transaction.amount),
    0,
  );

  const activeLinks = affiliateLinks.filter((link) => link.isActive).length;

  const conversionRate =
    totalClicks > 0
      ? Number(((successfulOrders / totalClicks) * 100).toFixed(2))
      : 0;

  return {
    reviewer: {
      id: reviewer.id,
      userId: reviewer.user.id,
      fullName: reviewer.user.fullName,
      email: reviewer.user.email,
      avatarUrl: reviewer.user.avatarUrl,
      role: reviewer.user.role,
    },

    affiliateLinks: {
      total: affiliateLinks.length,
      active: activeLinks,
      totalClicks,
      successfulOrders,
      conversionRate,
    },

    earnings: {
      total: totalEarnings,
      transactionCount: earningTransactions.length,
    },

    reviews: {
      total: totalReviews,
    },
  };
};

export const getReviewerRecentEarnings = async (
  reviewerId: string,
  limit: number,
) => {
  const reviewer = await prisma.customer.findUnique({
    where: {
      id: reviewerId,
    },

    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  if (!reviewer) {
    throw new AppError(404, "Không tìm thấy Reviewer");
  }

  if (reviewer.user.role !== "Reviewer") {
    throw new AppError(403, "Tài khoản chưa phải Reviewer");
  }

  const transactions = await prisma.reviewerEarningTransaction.findMany({
    where: {
      reviewerId,
    },

    include: {
      order: {
        select: {
          id: true,
          finalPrice: true,
          reviewerCommission: true,
          completedAt: true,
          orderedAt: true,

          merchant: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },

          affiliateLink: {
            select: {
              id: true,
              linkCode: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    take: limit,
  });

  return {
    reviewer: {
      id: reviewer.id,
      userId: reviewer.user.id,
      fullName: reviewer.user.fullName,
      email: reviewer.user.email,
      avatarUrl: reviewer.user.avatarUrl,
    },

    limit,

    items: transactions.map((transaction) => ({
      id: transaction.id,
      transactionId: transaction.id,

      orderId: transaction.orderId,
      reviewerId: transaction.reviewerId,

      amount: Number(transaction.amount),

      earningsAfter: Number(transaction.earningsAfter),

      type: transaction.type,
      reason: transaction.reason,

      order: {
        id: transaction.order.id,

        finalPrice: Number(transaction.order.finalPrice),

        reviewerCommission: Number(transaction.order.reviewerCommission),

        merchant: transaction.order.merchant,

        affiliateLink: transaction.order.affiliateLink,

        orderedAt: transaction.order.orderedAt,

        completedAt: transaction.order.completedAt,
      },

      createdAt: transaction.createdAt,
    })),
  };
};

export const getReviewerEarningsByYear = async (
  reviewerId: string,
  year: number,
) => {
  const reviewer = await prisma.customer.findUnique({
    where: {
      id: reviewerId,
    },

    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  if (!reviewer) {
    throw new AppError(404, "Không tìm thấy Reviewer");
  }

  if (reviewer.user.role !== "Reviewer") {
    throw new AppError(403, "Tài khoản chưa phải Reviewer");
  }

  const { startDate, endDate } = getYearRange(year);

  const transactions = await prisma.reviewerEarningTransaction.findMany({
    where: {
      reviewerId,

      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      amount: true,
      earningsAfter: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    earnings: 0,
    transactions: 0,
  }));

  for (const transaction of transactions) {
    const monthIndex = transaction.createdAt.getUTCMonth();
    const monthSummary = months[monthIndex];

    if (!monthSummary) {
      continue;
    }

    monthSummary.earnings += Number(transaction.amount);

    monthSummary.transactions += 1;
  }

  const totalEarnings = months.reduce(
    (total, month) => total + month.earnings,
    0,
  );

  return {
    reviewer: {
      id: reviewer.id,
      userId: reviewer.user.id,
      fullName: reviewer.user.fullName,
      email: reviewer.user.email,
      avatarUrl: reviewer.user.avatarUrl,
    },

    year,

    summary: {
      totalEarnings,

      totalTransactions: transactions.length,

      averageEarningPerTransaction:
        transactions.length > 0
          ? Number((totalEarnings / transactions.length).toFixed(2))
          : 0,
    },

    months,
  };
};

export const getReviewerAffiliateGrowthByYear = async (
  reviewerId: string,
  year: number,
) => {
  const reviewer = await prisma.customer.findUnique({
    where: {
      id: reviewerId,
    },

    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });

  if (!reviewer) {
    throw new AppError(404, "Không tìm thấy Reviewer");
  }

  if (reviewer.user.role !== "Reviewer") {
    throw new AppError(403, "Tài khoản chưa phải Reviewer");
  }

  const { startDate, endDate } = getYearRange(year);

  const affiliateLinks = await prisma.affiliateLink.findMany({
    where: {
      reviewerId,
    },

    select: {
      id: true,

      clicks: {
        where: {
          clickedAt: {
            gte: startDate,
            lt: endDate,
          },
        },

        select: {
          id: true,
          clickedAt: true,
        },
      },

      orders: {
        where: {
          status: OrderStatus.Completed,

          paymentStatus: OrderPaymentStatus.Paid,

          completedAt: {
            gte: startDate,
            lt: endDate,
          },
        },

        select: {
          id: true,
          reviewerCommission: true,
          completedAt: true,
        },
      },
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    clicks: 0,
    successfulOrders: 0,
    earnings: 0,
    conversionRate: 0,
  }));

  for (const link of affiliateLinks) {
    for (const click of link.clicks) {
      const monthIndex = click.clickedAt.getUTCMonth();
      const monthSummary = months[monthIndex];

      if (!monthSummary) {
        continue;
      }

      monthSummary.clicks += 1;
    }

    for (const order of link.orders) {
      if (!order.completedAt) {
        continue;
      }

      const monthIndex = order.completedAt.getUTCMonth();
      const monthSummary = months[monthIndex];

      if (!monthSummary) {
        continue;
      }

      monthSummary.successfulOrders += 1;

      monthSummary.earnings += Number(order.reviewerCommission);
    }
  }

  for (const month of months) {
    month.conversionRate =
      month.clicks > 0
        ? Number(((month.successfulOrders / month.clicks) * 100).toFixed(2))
        : 0;
  }

  const summary = months.reduce(
    (total, month) => ({
      totalClicks: total.totalClicks + month.clicks,

      successfulOrders: total.successfulOrders + month.successfulOrders,

      totalEarnings: total.totalEarnings + month.earnings,
    }),

    {
      totalClicks: 0,
      successfulOrders: 0,
      totalEarnings: 0,
    },
  );

  const conversionRate =
    summary.totalClicks > 0
      ? Number(
          ((summary.successfulOrders / summary.totalClicks) * 100).toFixed(2),
        )
      : 0;

  return {
    reviewer: {
      id: reviewer.id,
      userId: reviewer.user.id,
      fullName: reviewer.user.fullName,
      email: reviewer.user.email,
      avatarUrl: reviewer.user.avatarUrl,
    },

    year,

    summary: {
      ...summary,
      conversionRate,
    },

    months,
  };
};
