import {
  OrderPaymentStatus,
  OrderStatus,
} from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../common/errors/app-error.js";
import {
  createDateKeys,
  getVietnamDateRange,
  getYearRange,
  toVietnamDateKey,
} from "../utils/dashboard-date.util.js";

export const getStaffDashboard = async () => {
  const [
    totalUsers,
    totalCustomers,
    totalMerchants,
    activeMerchants,
    totalReviewers,
    totalOrders,
    paidOrders,
    pendingReviewerApplications,
  ] = await prisma.$transaction([
    prisma.user.count(),

    prisma.customer.count(),

    prisma.merchant.count(),

    prisma.merchant.count({
      where: {
        status: "Active",
      },
    }),

    prisma.user.count({
      where: {
        role: "Reviewer",
      },
    }),

    prisma.order.count(),

    prisma.order.findMany({
      where: {
        paymentStatus: OrderPaymentStatus.Paid,
      },

      select: {
        finalPrice: true,
      },
    }),

    prisma.reviewerApplication.count({
      where: {
        status: "Pending",
      },
    }),
  ]);

  const totalRevenue = paidOrders.reduce(
    (total, order) => total + Number(order.finalPrice),
    0,
  );

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      reviewers: totalReviewers,
    },

    merchants: {
      total: totalMerchants,
      active: activeMerchants,
    },

    orders: {
      total: totalOrders,
      paid: paidOrders.length,
    },

    revenue: {
      total: totalRevenue,
    },

    applications: {
      pendingReviewers: pendingReviewerApplications,
    },
  };
};

export const getStaffRevenueByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const paidOrders = await prisma.order.findMany({
    where: {
      paymentStatus: OrderPaymentStatus.Paid,

      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      finalPrice: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    revenue: 0,
    paidOrders: 0,
  }));

  for (const order of paidOrders) {
    const month = order.createdAt.getUTCMonth();
    const monthSummary = months[month];

    if (!monthSummary) {
      continue;
    }

    monthSummary.revenue += Number(order.finalPrice);

    monthSummary.paidOrders += 1;
  }

  const totalRevenue = months.reduce(
    (total, month) => total + month.revenue,
    0,
  );

  return {
    year,

    summary: {
      totalRevenue,
      totalPaidOrders: paidOrders.length,
    },

    months,
  };
};

export const getStaffRecentOrders = async (limit: number) => {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      name: true,

      status: true,
      paymentStatus: true,
      paymentMethod: true,
      orderType: true,

      subtotal: true,
      discount: true,
      finalPrice: true,
      reviewerCommission: true,

      orderedAt: true,
      acceptedAt: true,
      completedAt: true,

      customer: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              avatarUrl: true,
            },
          },
        },
      },

      merchant: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          phone: true,
          address: true,
        },
      },

      details: {
        select: {
          id: true,
          foodId: true,
          foodNameSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },

    orderBy: {
      orderedAt: "desc",
    },

    take: limit,
  });

  return {
    limit,

    items: orders.map((order) => ({
      id: order.id,
      orderId: order.id,

      customerName: order.name,

      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      orderType: order.orderType,

      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      finalPrice: Number(order.finalPrice),

      reviewerCommission: Number(order.reviewerCommission),

      totalItems: order.details.reduce(
        (total, detail) => total + detail.quantity,
        0,
      ),

      customer: {
        id: order.customer.id,
        userId: order.customer.user.id,
        fullName: order.customer.user.fullName,
        email: order.customer.user.email,
        phoneNumber: order.customer.user.phoneNumber,
        avatarUrl: order.customer.user.avatarUrl,
      },

      merchant: order.merchant,

      foods: order.details.map((detail) => ({
        orderDetailId: detail.id,
        foodId: detail.foodId,
        foodName: detail.foodNameSnapshot,
        quantity: detail.quantity,
        unitPrice: Number(detail.unitPrice),
        lineTotal: Number(detail.lineTotal),
      })),

      orderedAt: order.orderedAt,
      acceptedAt: order.acceptedAt,
      completedAt: order.completedAt,
    })),
  };
};

export const getStaffTopMerchants = async (limit: number) => {
  const merchants = await prisma.merchant.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true,
      address: true,
      rating: true,
      reviewCount: true,
      status: true,

      orders: {
        where: {
          paymentStatus: OrderPaymentStatus.Paid,
        },

        select: {
          id: true,
          finalPrice: true,
        },
      },
    },
  });

  const items = merchants
    .map((merchant) => {
      const totalRevenue = merchant.orders.reduce(
        (total, order) => total + Number(order.finalPrice),
        0,
      );

      return {
        merchantId: merchant.id,
        name: merchant.name,
        logoUrl: merchant.logoUrl,
        address: merchant.address,

        rating: Number(merchant.rating),
        reviewCount: merchant.reviewCount,
        status: merchant.status,

        paidOrders: merchant.orders.length,
        totalRevenue,
      };
    })
    .sort((first, second) => second.totalRevenue - first.totalRevenue)
    .slice(0, limit)
    .map((merchant, index) => ({
      rank: index + 1,
      ...merchant,
    }));

  return {
    limit,
    items,
  };
};

export const getStaffTopReviewers = async (limit: number) => {
  const reviewers = await prisma.customer.findMany({
    where: {
      user: {
        role: "Reviewer",
      },
    },

    select: {
      id: true,

      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },

      affiliateLinks: {
        select: {
          id: true,
          clickCount: true,
          successfulOrders: true,
          totalEarnings: true,
          isActive: true,
        },
      },

      earningTransactions: {
        select: {
          id: true,
          amount: true,
        },
      },

      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });

  const items = reviewers
    .map((reviewer) => {
      const totalClicks = reviewer.affiliateLinks.reduce(
        (total, link) => total + link.clickCount,
        0,
      );

      const successfulOrders = reviewer.affiliateLinks.reduce(
        (total, link) => total + link.successfulOrders,
        0,
      );

      const totalEarnings = reviewer.earningTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0,
      );

      const activeLinks = reviewer.affiliateLinks.filter(
        (link) => link.isActive,
      ).length;

      const conversionRate =
        totalClicks > 0
          ? Number(((successfulOrders / totalClicks) * 100).toFixed(2))
          : 0;

      return {
        reviewerId: reviewer.id,
        userId: reviewer.user.id,

        fullName: reviewer.user.fullName,

        email: reviewer.user.email,
        avatarUrl: reviewer.user.avatarUrl,

        totalAffiliateLinks: reviewer.affiliateLinks.length,

        activeAffiliateLinks: activeLinks,

        totalClicks,
        successfulOrders,
        conversionRate,

        totalEarnings,

        earningTransactionCount: reviewer.earningTransactions.length,

        totalReviews: reviewer._count.reviews,
      };
    })
    .sort((first, second) => second.totalEarnings - first.totalEarnings)
    .slice(0, limit)
    .map((reviewer, index) => ({
      rank: index + 1,
      ...reviewer,
    }));

  return {
    limit,
    items,
  };
};

export const getStaffTopFoods = async (limit: number) => {
  const orderDetails = await prisma.orderDetail.findMany({
    where: {
      order: {
        status: OrderStatus.Completed,
        paymentStatus: OrderPaymentStatus.Paid,
      },
    },

    select: {
      foodId: true,
      foodNameSnapshot: true,
      quantity: true,
      lineTotal: true,

      order: {
        select: {
          merchant: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  });

  const foodStatistics = new Map<
    string,
    {
      foodId: string;
      foodName: string;
      merchantId: string;
      merchantName: string;
      merchantLogoUrl: string | null;
      quantitySold: number;
      revenue: number;
      orderCount: number;
    }
  >();

  for (const detail of orderDetails) {
    const current = foodStatistics.get(detail.foodId);

    if (current) {
      current.quantitySold += detail.quantity;

      current.revenue += Number(detail.lineTotal);

      current.orderCount += 1;
    } else {
      foodStatistics.set(detail.foodId, {
        foodId: detail.foodId,
        foodName: detail.foodNameSnapshot,

        merchantId: detail.order.merchant.id,

        merchantName: detail.order.merchant.name,

        merchantLogoUrl: detail.order.merchant.logoUrl,

        quantitySold: detail.quantity,

        revenue: Number(detail.lineTotal),

        orderCount: 1,
      });
    }
  }

  const items = Array.from(foodStatistics.values())
    .sort((first, second) => second.quantitySold - first.quantitySold)
    .slice(0, limit)
    .map((food, index) => ({
      rank: index + 1,
      ...food,
    }));

  return {
    limit,
    items,
  };
};

export const getStaffUserGrowthByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      role: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,

    totalUsers: 0,

    customers: 0,
    merchants: 0,
    reviewers: 0,
    staffs: 0,
    admins: 0,
  }));

  for (const user of users) {
    const monthIndex = user.createdAt.getUTCMonth();

    const month = months[monthIndex];

    if (!month) {
      continue;
    }

    month.totalUsers += 1;

    switch (user.role) {
      case "Customer":
        month.customers += 1;
        break;

      case "Merchant":
        month.merchants += 1;
        break;

      case "Reviewer":
        month.reviewers += 1;
        break;

      case "Staff":
        month.staffs += 1;
        break;

      case "Admin":
        month.admins += 1;
        break;
    }
  }

  const summary = months.reduce(
    (total, month) => ({
      totalUsers: total.totalUsers + month.totalUsers,

      customers: total.customers + month.customers,

      merchants: total.merchants + month.merchants,

      reviewers: total.reviewers + month.reviewers,

      staffs: total.staffs + month.staffs,

      admins: total.admins + month.admins,
    }),

    {
      totalUsers: 0,
      customers: 0,
      merchants: 0,
      reviewers: 0,
      staffs: 0,
      admins: 0,
    },
  );

  return {
    year,
    summary,
    months,
  };
};

export const getStaffOrderGrowthByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,

    totalOrders: 0,

    pending: 0,
    accepted: 0,
    completed: 0,
    rejected: 0,

    paid: 0,
  }));

  for (const order of orders) {
    const monthIndex = order.createdAt.getUTCMonth();

    const month = months[monthIndex];

    if (!month) {
      continue;
    }

    month.totalOrders += 1;

    switch (order.status) {
      case OrderStatus.Pending:
        month.pending += 1;
        break;

      case OrderStatus.Accepted:
      case OrderStatus.Preparing:
      case OrderStatus.Ready:
      case OrderStatus.Delivering:
        month.accepted += 1;
        break;

      case OrderStatus.Completed:
        month.completed += 1;
        break;

      case OrderStatus.Rejected:
        month.rejected += 1;
        break;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      month.paid += 1;
    }
  }

  const summary = months.reduce(
    (total, month) => ({
      totalOrders: total.totalOrders + month.totalOrders,

      pending: total.pending + month.pending,

      accepted: total.accepted + month.accepted,

      completed: total.completed + month.completed,

      rejected: total.rejected + month.rejected,

      paid: total.paid + month.paid,
    }),

    {
      totalOrders: 0,
      pending: 0,
      accepted: 0,
      completed: 0,
      rejected: 0,
      paid: 0,
    },
  );

  return {
    year,
    summary,
    months,
  };
};

export const getStaffReviewStatistics = async () => {
  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      rating: true,
      content: true,
      imageUrl: true,
      createdAt: true,

      customer: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },

      merchant: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },

      order: {
        select: {
          id: true,
          orderedAt: true,
          completedAt: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const ratingCounts = {
    oneStar: 0,
    twoStars: 0,
    threeStars: 0,
    fourStars: 0,
    fiveStars: 0,
  };

  let totalRating = 0;

  for (const review of reviews) {
    totalRating += review.rating;

    switch (review.rating) {
      case 1:
        ratingCounts.oneStar += 1;
        break;

      case 2:
        ratingCounts.twoStars += 1;
        break;

      case 3:
        ratingCounts.threeStars += 1;
        break;

      case 4:
        ratingCounts.fourStars += 1;
        break;

      case 5:
        ratingCounts.fiveStars += 1;
        break;
    }
  }

  const totalReviews = reviews.length;

  const averageRating =
    totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;

  const calculatePercentage = (count: number) => {
    if (totalReviews === 0) {
      return 0;
    }

    return Number(((count / totalReviews) * 100).toFixed(2));
  };

  return {
    summary: {
      totalReviews,
      averageRating,
    },

    ratings: {
      counts: {
        1: ratingCounts.oneStar,
        2: ratingCounts.twoStars,
        3: ratingCounts.threeStars,
        4: ratingCounts.fourStars,
        5: ratingCounts.fiveStars,
      },

      percentages: {
        1: calculatePercentage(ratingCounts.oneStar),

        2: calculatePercentage(ratingCounts.twoStars),

        3: calculatePercentage(ratingCounts.threeStars),

        4: calculatePercentage(ratingCounts.fourStars),

        5: calculatePercentage(ratingCounts.fiveStars),
      },
    },

    recentReviews: reviews.slice(0, 10).map((review) => ({
      id: review.id,
      reviewId: review.id,

      rating: review.rating,
      content: review.content,
      imageUrl: review.imageUrl,

      customer: {
        id: review.customer.id,

        userId: review.customer.user.id,

        fullName: review.customer.user.fullName,

        avatarUrl: review.customer.user.avatarUrl,
      },

      merchant: review.merchant,
      order: review.order,

      createdAt: review.createdAt,
    })),
  };
};

export const getStaffPaymentStatisticsByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const paymentMethods = {
    Cash: {
      totalOrders: 0,
      paidOrders: 0,
      revenue: 0,
      percentage: 0,
    },

    COD: {
      totalOrders: 0,
      paidOrders: 0,
      revenue: 0,
      percentage: 0,
    },

    BankTransfer: {
      totalOrders: 0,
      paidOrders: 0,
      revenue: 0,
      percentage: 0,
    },
  };

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,

    Cash: {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
    },

    COD: {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
    },

    BankTransfer: {
      orders: 0,
      paidOrders: 0,
      revenue: 0,
    },
  }));

  for (const order of orders) {
    const paymentMethod = order.paymentMethod as
      | "Cash"
      | "COD"
      | "BankTransfer";

    const methodStatistics = paymentMethods[paymentMethod];

    if (!methodStatistics) {
      continue;
    }

    methodStatistics.totalOrders += 1;

    const monthIndex = order.createdAt.getUTCMonth();
    const monthStatistics = months[monthIndex];

    if (!monthStatistics) {
      continue;
    }

    const monthMethodStatistics = monthStatistics[paymentMethod];

    monthMethodStatistics.orders += 1;

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      const revenue = Number(order.finalPrice);

      methodStatistics.paidOrders += 1;
      methodStatistics.revenue += revenue;

      monthMethodStatistics.paidOrders += 1;

      monthMethodStatistics.revenue += revenue;
    }
  }

  const totalOrders = orders.length;

  for (const method of Object.values(paymentMethods)) {
    method.percentage =
      totalOrders > 0
        ? Number(((method.totalOrders / totalOrders) * 100).toFixed(2))
        : 0;
  }

  const totalPaidOrders = Object.values(paymentMethods).reduce(
    (total, method) => total + method.paidOrders,
    0,
  );

  const totalRevenue = Object.values(paymentMethods).reduce(
    (total, method) => total + method.revenue,
    0,
  );

  return {
    year,

    summary: {
      totalOrders,
      totalPaidOrders,
      totalRevenue,
    },

    paymentMethods,
    months,
  };
};

export const getStaffPeakHoursByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      status: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,

      merchant: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,

    timeRange: `${hour.toString().padStart(2, "0")}:00 - ${((hour + 1) % 24)
      .toString()
      .padStart(2, "0")}:00`,

    totalOrders: 0,
    completedOrders: 0,
    paidOrders: 0,
    rejectedOrders: 0,

    revenue: 0,
    averageOrderValue: 0,
    percentage: 0,
  }));

  for (const order of orders) {
    // Chuyển giờ UTC sang giờ Việt Nam UTC+7
    const hourIndex = (order.createdAt.getUTCHours() + 7) % 24;

    const hourStatistics = hours[hourIndex]!;

    hourStatistics.totalOrders += 1;

    if (order.status === OrderStatus.Completed) {
      hourStatistics.completedOrders += 1;
    }

    if (order.status === OrderStatus.Rejected) {
      hourStatistics.rejectedOrders += 1;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      hourStatistics.paidOrders += 1;
    }

    if (
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid
    ) {
      hourStatistics.revenue += Number(order.finalPrice);
    }
  }

  const totalOrders = orders.length;

  for (const hour of hours) {
    hour.percentage =
      totalOrders > 0
        ? Number(((hour.totalOrders / totalOrders) * 100).toFixed(2))
        : 0;

    hour.averageOrderValue =
      hour.completedOrders > 0
        ? Number((hour.revenue / hour.completedOrders).toFixed(2))
        : 0;
  }

  const totalCompletedOrders = hours.reduce(
    (total, hour) => total + hour.completedOrders,
    0,
  );

  const totalPaidOrders = hours.reduce(
    (total, hour) => total + hour.paidOrders,
    0,
  );

  const totalRejectedOrders = hours.reduce(
    (total, hour) => total + hour.rejectedOrders,
    0,
  );

  const totalRevenue = hours.reduce((total, hour) => total + hour.revenue, 0);

  const averageOrderValue =
    totalCompletedOrders > 0
      ? Number((totalRevenue / totalCompletedOrders).toFixed(2))
      : 0;

  const peakHour =
    totalOrders > 0
      ? hours.reduce(
          (currentPeak, hour) =>
            hour.totalOrders > currentPeak.totalOrders ? hour : currentPeak,
          hours[0]!,
        )
      : null;

  const topHours = [...hours]
    .sort((first, second) => second.totalOrders - first.totalOrders)
    .slice(0, 5)
    .map((hour, index) => ({
      rank: index + 1,
      ...hour,
    }));

  return {
    year,

    timezone: "Asia/Ho_Chi_Minh",

    summary: {
      totalOrders,
      totalCompletedOrders,
      totalPaidOrders,
      totalRejectedOrders,
      totalRevenue,
      averageOrderValue,

      peakHour: peakHour
        ? {
            hour: peakHour.hour,
            timeRange: peakHour.timeRange,
            totalOrders: peakHour.totalOrders,
            completedOrders: peakHour.completedOrders,
            revenue: peakHour.revenue,
            percentage: peakHour.percentage,
          }
        : null,
    },

    topHours,
    hours,
  };
};

export const getStaffWeekdayStatisticsByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      status: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const weekdays = [
    {
      dayIndex: 1,
      dayName: "Thứ Hai",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 2,
      dayName: "Thứ Ba",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 3,
      dayName: "Thứ Tư",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 4,
      dayName: "Thứ Năm",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 5,
      dayName: "Thứ Sáu",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 6,
      dayName: "Thứ Bảy",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
    {
      dayIndex: 0,
      dayName: "Chủ Nhật",
      totalOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
  ];

  for (const order of orders) {
    // Chuyển UTC sang giờ Việt Nam UTC+7
    const vietnamDate = new Date(
      order.createdAt.getTime() + 7 * 60 * 60 * 1000,
    );

    const dayIndex = vietnamDate.getUTCDay();

    const weekday = weekdays.find((item) => item.dayIndex === dayIndex);

    if (!weekday) {
      continue;
    }

    weekday.totalOrders += 1;

    if (order.status === OrderStatus.Completed) {
      weekday.completedOrders += 1;
    }

    if (order.status === OrderStatus.Rejected) {
      weekday.rejectedOrders += 1;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      weekday.paidOrders += 1;
    }

    if (
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid
    ) {
      weekday.revenue += Number(order.finalPrice);
    }
  }

  const totalOrders = orders.length;

  for (const weekday of weekdays) {
    weekday.percentage =
      totalOrders > 0
        ? Number(((weekday.totalOrders / totalOrders) * 100).toFixed(2))
        : 0;

    weekday.averageOrderValue =
      weekday.completedOrders > 0
        ? Number((weekday.revenue / weekday.completedOrders).toFixed(2))
        : 0;
  }

  const totalCompletedOrders = weekdays.reduce(
    (total, weekday) => total + weekday.completedOrders,
    0,
  );

  const totalRejectedOrders = weekdays.reduce(
    (total, weekday) => total + weekday.rejectedOrders,
    0,
  );

  const totalPaidOrders = weekdays.reduce(
    (total, weekday) => total + weekday.paidOrders,
    0,
  );

  const totalRevenue = weekdays.reduce(
    (total, weekday) => total + weekday.revenue,
    0,
  );

  const averageOrderValue =
    totalCompletedOrders > 0
      ? Number((totalRevenue / totalCompletedOrders).toFixed(2))
      : 0;

  const peakWeekday =
    totalOrders > 0
      ? weekdays.reduce(
          (currentPeak, weekday) =>
            weekday.totalOrders > currentPeak.totalOrders
              ? weekday
              : currentPeak,
          weekdays[0]!,
        )
      : null;

  const ranking = [...weekdays]
    .sort((first, second) => second.totalOrders - first.totalOrders)
    .map((weekday, index) => ({
      rank: index + 1,
      ...weekday,
    }));

  return {
    year,

    timezone: "Asia/Ho_Chi_Minh",

    summary: {
      totalOrders,
      totalCompletedOrders,
      totalRejectedOrders,
      totalPaidOrders,
      totalRevenue,
      averageOrderValue,

      peakWeekday: peakWeekday
        ? {
            dayIndex: peakWeekday.dayIndex,

            dayName: peakWeekday.dayName,

            totalOrders: peakWeekday.totalOrders,

            completedOrders: peakWeekday.completedOrders,

            revenue: peakWeekday.revenue,

            percentage: peakWeekday.percentage,
          }
        : null,
    },

    ranking,
    weekdays,
  };
};

export const getStaffOrderPerformanceByYear = async (year: number) => {
  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      status: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,

      merchant: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,

    totalOrders: 0,
    pendingOrders: 0,
    acceptedOrders: 0,
    completedOrders: 0,
    rejectedOrders: 0,
    paidOrders: 0,

    revenue: 0,
    completionRate: 0,
    rejectionRate: 0,
    paymentRate: 0,
  }));

  for (const order of orders) {
    const monthIndex = order.createdAt.getUTCMonth();

    const month = months[monthIndex];

    month!.totalOrders += 1;

    switch (order.status) {
      case OrderStatus.Pending:
        month!.pendingOrders += 1;
        break;

      case OrderStatus.Accepted:
      case OrderStatus.Preparing:
      case OrderStatus.Ready:
      case OrderStatus.Delivering:
        month!.acceptedOrders += 1;
        break;

      case OrderStatus.Completed:
        month!.completedOrders += 1;
        break;

      case OrderStatus.Rejected:
        month!.rejectedOrders += 1;
        break;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      month!.paidOrders += 1;
    }

    if (
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid
    ) {
      month!.revenue += Number(order.finalPrice);
    }
  }

  for (const month of months) {
    if (month.totalOrders === 0) {
      continue;
    }

    month.completionRate = Number(
      ((month.completedOrders / month.totalOrders) * 100).toFixed(2),
    );

    month.rejectionRate = Number(
      ((month.rejectedOrders / month.totalOrders) * 100).toFixed(2),
    );

    month.paymentRate = Number(
      ((month.paidOrders / month.totalOrders) * 100).toFixed(2),
    );
  }

  const summary = months.reduce(
    (total, month) => ({
      totalOrders: total.totalOrders + month.totalOrders,

      pendingOrders: total.pendingOrders + month.pendingOrders,

      acceptedOrders: total.acceptedOrders + month.acceptedOrders,

      completedOrders: total.completedOrders + month.completedOrders,

      rejectedOrders: total.rejectedOrders + month.rejectedOrders,

      paidOrders: total.paidOrders + month.paidOrders,

      totalRevenue: total.totalRevenue + month.revenue,
    }),

    {
      totalOrders: 0,
      pendingOrders: 0,
      acceptedOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,
      totalRevenue: 0,
    },
  );

  const completionRate =
    summary.totalOrders > 0
      ? Number(
          ((summary.completedOrders / summary.totalOrders) * 100).toFixed(2),
        )
      : 0;

  const rejectionRate =
    summary.totalOrders > 0
      ? Number(
          ((summary.rejectedOrders / summary.totalOrders) * 100).toFixed(2),
        )
      : 0;

  const paymentRate =
    summary.totalOrders > 0
      ? Number(((summary.paidOrders / summary.totalOrders) * 100).toFixed(2))
      : 0;

  const averageOrderValue =
    summary.completedOrders > 0
      ? Number((summary.totalRevenue / summary.completedOrders).toFixed(2))
      : 0;

  const bestMonth =
    summary.totalOrders > 0
      ? months.reduce(
          (currentBest, month) =>
            month.revenue > currentBest!.revenue ? month : currentBest,
          months[0],
        )
      : null;

  const worstMonth =
    summary.totalOrders > 0
      ? months
          .filter((month) => month.totalOrders > 0)
          .reduce((currentWorst, month) =>
            month.rejectionRate > currentWorst.rejectionRate
              ? month
              : currentWorst,
          )
      : null;

  return {
    year,

    summary: {
      ...summary,

      completionRate,
      rejectionRate,
      paymentRate,
      averageOrderValue,

      bestMonth: bestMonth
        ? {
            month: bestMonth.month,
            totalOrders: bestMonth.totalOrders,
            completedOrders: bestMonth.completedOrders,
            revenue: bestMonth.revenue,
          }
        : null,

      highestRejectionMonth: worstMonth
        ? {
            month: worstMonth.month,
            totalOrders: worstMonth.totalOrders,
            rejectedOrders: worstMonth.rejectedOrders,
            rejectionRate: worstMonth.rejectionRate,
          }
        : null,
    },

    months,
  };
};

export const getStaffDailyRevenue = async (
  startDateValue: string,
  endDateValue: string,
) => {
  const { startDate, endDate } = getVietnamDateRange(
    startDateValue,
    endDateValue,
  );

  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },

    select: {
      id: true,
      status: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const dateKeys = createDateKeys(startDateValue, endDateValue);

  const days = dateKeys.map((date) => {
    return {
      date,
      totalOrders: 0,
      completedOrders: 0,
      paidOrders: 0,
      rejectedOrders: 0,

      revenue: 0,
      averageOrderValue: 0,
    };
  });

  const dayMap = new Map(days.map((day) => [day.date, day]));

  for (const order of orders) {
    const dateKey = toVietnamDateKey(order.createdAt);

    const day = dayMap.get(dateKey);

    if (!day) {
      continue;
    }

    day.totalOrders += 1;

    if (order.status === OrderStatus.Completed) {
      day.completedOrders += 1;
    }

    if (order.status === OrderStatus.Rejected) {
      day.rejectedOrders += 1;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      day.paidOrders += 1;
    }

    if (
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid
    ) {
      day.revenue += Number(order.finalPrice);
    }
  }

  for (const day of days) {
    day.averageOrderValue =
      day.completedOrders > 0
        ? Number((day.revenue / day.completedOrders).toFixed(2))
        : 0;
  }

  const summary = days.reduce(
    (total, day) => ({
      totalOrders: total.totalOrders + day.totalOrders,

      completedOrders: total.completedOrders + day.completedOrders,

      paidOrders: total.paidOrders + day.paidOrders,

      rejectedOrders: total.rejectedOrders + day.rejectedOrders,

      totalRevenue: total.totalRevenue + day.revenue,
    }),

    {
      totalOrders: 0,
      completedOrders: 0,
      paidOrders: 0,
      rejectedOrders: 0,
      totalRevenue: 0,
    },
  );

  const averageOrderValue =
    summary.completedOrders > 0
      ? Number((summary.totalRevenue / summary.completedOrders).toFixed(2))
      : 0;

  const highestRevenueDay =
    summary.totalOrders > 0
      ? days.reduce(
          (currentHighest, day) =>
            day.revenue > currentHighest!.revenue ? day : currentHighest,
          days[0],
        )
      : null;

  const highestOrderDay =
    summary.totalOrders > 0
      ? days.reduce(
          (currentHighest, day) =>
            day.totalOrders > currentHighest!.totalOrders
              ? day
              : currentHighest,
          days[0],
        )
      : null;

  return {
    startDate: startDateValue,
    endDate: endDateValue,
    timezone: "Asia/Ho_Chi_Minh",

    summary: {
      ...summary,
      averageOrderValue,

      highestRevenueDay: highestRevenueDay
        ? {
            date: highestRevenueDay.date,

            totalOrders: highestRevenueDay.totalOrders,

            completedOrders: highestRevenueDay.completedOrders,

            revenue: highestRevenueDay.revenue,
          }
        : null,

      highestOrderDay: highestOrderDay
        ? {
            date: highestOrderDay.date,

            totalOrders: highestOrderDay.totalOrders,

            completedOrders: highestOrderDay.completedOrders,

            revenue: highestOrderDay.revenue,
          }
        : null,
    },

    days,
  };
};
