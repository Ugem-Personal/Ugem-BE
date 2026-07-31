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

export const getMerchantDashboard = async (merchantId: string) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
      rating: true,
      reviewCount: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const [
    totalOrders,
    pendingOrders,
    acceptedOrders,
    completedOrders,
    paidOrders,
    totalFoods,
    totalCampaigns,
    activeCampaigns,
  ] = await prisma.$transaction([
    prisma.order.count({
      where: {
        merchantId,
      },
    }),

    prisma.order.count({
      where: {
        merchantId,
        status: OrderStatus.Pending,
      },
    }),

    prisma.order.count({
      where: {
        merchantId,
        status: OrderStatus.Accepted,
      },
    }),

    prisma.order.count({
      where: {
        merchantId,
        status: OrderStatus.Completed,
      },
    }),

    prisma.order.findMany({
      where: {
        merchantId,
        paymentStatus: OrderPaymentStatus.Paid,
      },

      select: {
        finalPrice: true,
      },
    }),

    prisma.food.count({
      where: {
        merchantId,
      },
    }),

    prisma.campaign.count({
      where: {
        merchantId,
      },
    }),

    prisma.campaign.count({
      where: {
        merchantId,
        isActive: true,
        startAt: {
          lte: new Date(),
        },
        endAt: {
          gte: new Date(),
        },
      },
    }),
  ]);

  const totalRevenue = paidOrders.reduce(
    (total, order) => total + Number(order.finalPrice),
    0,
  );

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      rating: Number(merchant.rating),
      reviewCount: merchant.reviewCount,
    },

    orders: {
      total: totalOrders,
      pending: pendingOrders,
      accepted: acceptedOrders,
      completed: completedOrders,
      paid: paidOrders.length,
    },

    revenue: {
      total: totalRevenue,
    },

    foods: {
      total: totalFoods,
    },

    campaigns: {
      total: totalCampaigns,
      active: activeCampaigns,
    },
  };
};

export const getMerchantRevenueByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const paidOrders = await prisma.order.findMany({
    where: {
      merchantId,

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
    const monthIndex = order.createdAt.getUTCMonth();
    const monthSummary = months[monthIndex];

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
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    year,

    summary: {
      totalRevenue,
      totalPaidOrders: paidOrders.length,
    },

    months,
  };
};

export const getMerchantTopFoods = async (
  merchantId: string,
  limit: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const orderDetails = await prisma.orderDetail.findMany({
    where: {
      order: {
        merchantId,

        status: OrderStatus.Completed,

        paymentStatus: OrderPaymentStatus.Paid,
      },
    },

    select: {
      foodId: true,
      foodNameSnapshot: true,
      quantity: true,
      lineTotal: true,
    },
  });

  const foodStatistics = new Map<
    string,
    {
      foodId: string;
      foodName: string;
      quantitySold: number;
      revenue: number;
    }
  >();

  for (const detail of orderDetails) {
    const current = foodStatistics.get(detail.foodId);

    if (current) {
      current.quantitySold += detail.quantity;

      current.revenue += Number(detail.lineTotal);
    } else {
      foodStatistics.set(detail.foodId, {
        foodId: detail.foodId,

        foodName: detail.foodNameSnapshot,

        quantitySold: detail.quantity,

        revenue: Number(detail.lineTotal),
      });
    }
  }

  const items = Array.from(foodStatistics.values())
    .sort((first, second) => second.quantitySold - first.quantitySold)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    limit,
    items,
  };
};

export const getMerchantRecentOrders = async (
  merchantId: string,
  limit: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const orders = await prisma.order.findMany({
    where: {
      merchantId,
    },

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
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

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

export const getMerchantOrderGrowthByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    year,
    summary,
    months,
  };
};

export const getMerchantCampaignPerformance = async (
  merchantId: string,
  limit: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      merchantId,
    },

    select: {
      id: true,
      name: true,
      description: true,

      discountType: true,
      discountValue: true,

      minimumOrderAmount: true,
      maximumDiscount: true,

      startAt: true,
      endAt: true,

      usageLimit: true,
      usedCount: true,
      isActive: true,

      orders: {
        select: {
          id: true,
          subtotal: true,
          discount: true,
          finalPrice: true,
          status: true,
          paymentStatus: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const now = new Date();

  const items = campaigns
    .map((campaign) => {
      const paidOrders = campaign.orders.filter(
        (order) => order.paymentStatus === OrderPaymentStatus.Paid,
      );

      const completedPaidOrders = paidOrders.filter(
        (order) => order.status === OrderStatus.Completed,
      );

      const totalRevenue = completedPaidOrders.reduce(
        (total, order) => total + Number(order.finalPrice),
        0,
      );

      const totalDiscount = campaign.orders.reduce(
        (total, order) => total + Number(order.discount),
        0,
      );

      const averageOrderValue =
        completedPaidOrders.length > 0
          ? Number((totalRevenue / completedPaidOrders.length).toFixed(2))
          : 0;

      let campaignStatus:
        | "Upcoming"
        | "Active"
        | "Expired"
        | "Disabled"
        | "OutOfUsage";

      if (!campaign.isActive) {
        campaignStatus = "Disabled";
      } else if (
        campaign.usageLimit !== null &&
        campaign.usedCount >= campaign.usageLimit
      ) {
        campaignStatus = "OutOfUsage";
      } else if (now < campaign.startAt) {
        campaignStatus = "Upcoming";
      } else if (now > campaign.endAt) {
        campaignStatus = "Expired";
      } else {
        campaignStatus = "Active";
      }

      return {
        campaignId: campaign.id,
        name: campaign.name,
        description: campaign.description,

        discountType: campaign.discountType,

        discountValue: Number(campaign.discountValue),

        minimumOrderAmount: Number(campaign.minimumOrderAmount),

        maximumDiscount:
          campaign.maximumDiscount !== null
            ? Number(campaign.maximumDiscount)
            : null,

        usageLimit: campaign.usageLimit,
        usedCount: campaign.usedCount,

        remainingUsage:
          campaign.usageLimit !== null
            ? Math.max(campaign.usageLimit - campaign.usedCount, 0)
            : null,

        totalOrders: campaign.orders.length,

        paidOrders: paidOrders.length,

        completedPaidOrders: completedPaidOrders.length,

        totalRevenue,
        totalDiscount,
        averageOrderValue,

        isActive: campaign.isActive,
        status: campaignStatus,

        startAt: campaign.startAt,
        endAt: campaign.endAt,
      };
    })
    .sort((first, second) => second.totalRevenue - first.totalRevenue)
    .slice(0, limit)
    .map((campaign, index) => ({
      rank: index + 1,
      ...campaign,
    }));

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    limit,
    items,
  };
};

export const getMerchantReviewStatistics = async (merchantId: string) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
      rating: true,
      reviewCount: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const reviews = await prisma.review.findMany({
    where: {
      merchantId,
    },

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

  for (const review of reviews) {
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

  const calculatePercentage = (count: number) => {
    if (totalReviews === 0) {
      return 0;
    }

    return Number(((count / totalReviews) * 100).toFixed(2));
  };

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      averageRating: Number(merchant.rating),
      reviewCount: merchant.reviewCount,
    },

    ratings: {
      total: totalReviews,

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

    recentReviews: reviews.slice(0, 5).map((review) => ({
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

      order: review.order,

      createdAt: review.createdAt,
    })),
  };
};

export const getMerchantPaymentStatisticsByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

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

export const getMerchantCustomerStatisticsByYear = async (
  merchantId: string,
  year: number,
  limit: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },

    select: {
      id: true,
      customerId: true,
      status: true,
      paymentStatus: true,
      finalPrice: true,
      createdAt: true,

      customer: {
        select: {
          id: true,

          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
      },
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  const customerMap = new Map<
    string,
    {
      customerId: string;
      userId: string;
      fullName: string;
      email: string;
      phoneNumber: string | null;
      avatarUrl: string | null;
      accountCreatedAt: Date;

      totalOrders: number;
      completedOrders: number;
      paidOrders: number;
      totalSpending: number;

      firstOrderAt: Date;
      latestOrderAt: Date;
    }
  >();

  for (const order of orders) {
    const existingCustomer = customerMap.get(order.customerId);

    if (!existingCustomer) {
      customerMap.set(order.customerId, {
        customerId: order.customer.id,
        userId: order.customer.user.id,
        fullName: order.customer.user.fullName,
        email: order.customer.user.email,
        phoneNumber: order.customer.user.phoneNumber,
        avatarUrl: order.customer.user.avatarUrl,

        accountCreatedAt: order.customer.user.createdAt,

        totalOrders: 1,

        completedOrders: order.status === OrderStatus.Completed ? 1 : 0,

        paidOrders: order.paymentStatus === OrderPaymentStatus.Paid ? 1 : 0,

        totalSpending:
          order.paymentStatus === OrderPaymentStatus.Paid &&
          order.status === OrderStatus.Completed
            ? Number(order.finalPrice)
            : 0,

        firstOrderAt: order.createdAt,
        latestOrderAt: order.createdAt,
      });

      continue;
    }

    existingCustomer.totalOrders += 1;

    if (order.status === OrderStatus.Completed) {
      existingCustomer.completedOrders += 1;
    }

    if (order.paymentStatus === OrderPaymentStatus.Paid) {
      existingCustomer.paidOrders += 1;
    }

    if (
      order.status === OrderStatus.Completed &&
      order.paymentStatus === OrderPaymentStatus.Paid
    ) {
      existingCustomer.totalSpending += Number(order.finalPrice);
    }

    if (order.createdAt < existingCustomer.firstOrderAt) {
      existingCustomer.firstOrderAt = order.createdAt;
    }

    if (order.createdAt > existingCustomer.latestOrderAt) {
      existingCustomer.latestOrderAt = order.createdAt;
    }
  }

  const customers = Array.from(customerMap.values());

  const returningCustomers = customers.filter(
    (customer) => customer.totalOrders >= 2,
  );

  const oneTimeCustomers = customers.filter(
    (customer) => customer.totalOrders === 1,
  );

  const newCustomers = customers.filter(
    (customer) =>
      customer.accountCreatedAt >= startDate &&
      customer.accountCreatedAt < endDate,
  );

  const totalRevenue = customers.reduce(
    (total, customer) => total + customer.totalSpending,
    0,
  );

  const averageSpendingPerCustomer =
    customers.length > 0
      ? Number((totalRevenue / customers.length).toFixed(2))
      : 0;

  const returningCustomerRate =
    customers.length > 0
      ? Number(
          ((returningCustomers.length / customers.length) * 100).toFixed(2),
        )
      : 0;

  const topCustomers = customers
    .sort((first, second) => second.totalSpending - first.totalSpending)
    .slice(0, limit)
    .map((customer, index) => ({
      rank: index + 1,

      customerId: customer.customerId,
      userId: customer.userId,

      fullName: customer.fullName,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      avatarUrl: customer.avatarUrl,

      totalOrders: customer.totalOrders,

      completedOrders: customer.completedOrders,

      paidOrders: customer.paidOrders,

      totalSpending: Number(customer.totalSpending.toFixed(2)),

      firstOrderAt: customer.firstOrderAt,

      latestOrderAt: customer.latestOrderAt,
    }));

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    year,

    summary: {
      totalCustomers: customers.length,

      newCustomers: newCustomers.length,

      returningCustomers: returningCustomers.length,

      oneTimeCustomers: oneTimeCustomers.length,

      returningCustomerRate,

      totalRevenue,

      averageSpendingPerCustomer,
    },

    topCustomers,
  };
};

export const getMerchantPeakHoursByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,

    timeRange: `${hour.toString().padStart(2, "0")}:00 - ${((hour + 1) % 24)
      .toString()
      .padStart(2, "0")}:00`,

    totalOrders: 0,
    completedOrders: 0,
    paidOrders: 0,

    revenue: 0,
    averageOrderValue: 0,

    percentage: 0,
  }));

  for (const order of orders) {
    const hourIndex = (order.createdAt.getUTCHours() + 7) % 24;
    const hourStatistics = hours[hourIndex]!;

    if (!hourStatistics) {
      continue;
    }

    hourStatistics.totalOrders += 1;

    if (order.status === OrderStatus.Completed) {
      hourStatistics.completedOrders += 1;
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

  const totalRevenue = hours.reduce((total, hour) => total + hour.revenue, 0);

  const defaultPeakHour = hours[0];

  if (!defaultPeakHour) {
    throw new AppError(500, "Dashboard hourly statistics are unavailable");
  }

  const peakHour = hours.reduce((currentPeak, hour) => {
    if (hour.totalOrders > currentPeak.totalOrders) {
      return hour;
    }

    return currentPeak;
  }, defaultPeakHour);

  const topHours = [...hours]
    .sort((first, second) => second.totalOrders - first.totalOrders)
    .slice(0, 5)
    .map((hour, index) => ({
      rank: index + 1,
      ...hour,
    }));

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    year,

    summary: {
      totalOrders,
      totalCompletedOrders,
      totalPaidOrders,
      totalRevenue,

      peakHour: {
        hour: peakHour.hour,
        timeRange: peakHour.timeRange,
        totalOrders: peakHour.totalOrders,
        percentage: peakHour.percentage,
      },
    },

    topHours,
    hours,
  };
};

export const getMerchantWeekdayStatisticsByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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
      paidOrders: 0,
      revenue: 0,
      averageOrderValue: 0,
      percentage: 0,
    },
  ];

  for (const order of orders) {
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

  const totalPaidOrders = weekdays.reduce(
    (total, weekday) => total + weekday.paidOrders,
    0,
  );

  const totalRevenue = weekdays.reduce(
    (total, weekday) => total + weekday.revenue,
    0,
  );

  const peakWeekday = weekdays.reduce((currentPeak, weekday) => {
    if (weekday.totalOrders > currentPeak.totalOrders) {
      return weekday;
    }

    return currentPeak;
  }, weekdays[0]!);

  const ranking = [...weekdays]
    .sort((first, second) => second.totalOrders - first.totalOrders)
    .map((weekday, index) => ({
      rank: index + 1,
      ...weekday,
    }));

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    year,

    summary: {
      totalOrders,
      totalCompletedOrders,
      totalPaidOrders,
      totalRevenue,

      peakWeekday: {
        dayIndex: peakWeekday.dayIndex,

        dayName: peakWeekday.dayName,

        totalOrders: peakWeekday.totalOrders,

        percentage: peakWeekday.percentage,
      },
    },

    ranking,
    weekdays,
  };
};

export const getMerchantOrderPerformanceByYear = async (
  merchantId: string,
  year: number,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  const { startDate, endDate } = getYearRange(year);

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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
    month.completionRate =
      month.totalOrders > 0
        ? Number(((month.completedOrders / month.totalOrders) * 100).toFixed(2))
        : 0;

    month.rejectionRate =
      month.totalOrders > 0
        ? Number(((month.rejectedOrders / month.totalOrders) * 100).toFixed(2))
        : 0;
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

  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

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
    },

    months,
  };
};

export const getMerchantDailyRevenue = async (
  merchantId: string,
  startDateValue: string,
  endDateValue: string,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: merchantId,
    },

    select: {
      id: true,
      name: true,
    },
  });

  if (!merchant) {
    throw new AppError(404, "Không tìm thấy Merchant");
  }

  /*
   * startDate và endDate được hiểu theo giờ Việt Nam.
   * PostgreSQL vẫn lưu và so sánh bằng UTC.
   */
  const { startDate, endDate } = getVietnamDateRange(
    startDateValue,
    endDateValue,
  );

  const orders = await prisma.order.findMany({
    where: {
      merchantId,

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
      pendingOrders: 0,
      acceptedOrders: 0,
      completedOrders: 0,
      rejectedOrders: 0,
      paidOrders: 0,

      revenue: 0,
      averageOrderValue: 0,

      completionRate: 0,
      rejectionRate: 0,
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

    switch (order.status) {
      case OrderStatus.Pending:
        day.pendingOrders += 1;
        break;

      case OrderStatus.Accepted:
        day.acceptedOrders += 1;
        break;

      case OrderStatus.Completed:
        day.completedOrders += 1;
        break;

      case OrderStatus.Rejected:
        day.rejectedOrders += 1;
        break;
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

    day.completionRate =
      day.totalOrders > 0
        ? Number(((day.completedOrders / day.totalOrders) * 100).toFixed(2))
        : 0;

    day.rejectionRate =
      day.totalOrders > 0
        ? Number(((day.rejectedOrders / day.totalOrders) * 100).toFixed(2))
        : 0;
  }

  const summary = days.reduce(
    (total, day) => ({
      totalOrders: total.totalOrders + day.totalOrders,

      pendingOrders: total.pendingOrders + day.pendingOrders,

      acceptedOrders: total.acceptedOrders + day.acceptedOrders,

      completedOrders: total.completedOrders + day.completedOrders,

      rejectedOrders: total.rejectedOrders + day.rejectedOrders,

      paidOrders: total.paidOrders + day.paidOrders,

      totalRevenue: total.totalRevenue + day.revenue,
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

  const averageOrderValue =
    summary.completedOrders > 0
      ? Number((summary.totalRevenue / summary.completedOrders).toFixed(2))
      : 0;

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

  const highestRevenueDay =
    summary.totalRevenue > 0
      ? days.reduce(
          (currentHighest, day) =>
            day.revenue > currentHighest!.revenue ? day : currentHighest,
          days[0],
        )
      : null;

  const busiestDay =
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
    merchant: {
      id: merchant.id,
      name: merchant.name,
    },

    startDate: startDateValue,
    endDate: endDateValue,
    timezone: "Asia/Ho_Chi_Minh",

    summary: {
      ...summary,
      averageOrderValue,
      completionRate,
      rejectionRate,

      highestRevenueDay: highestRevenueDay
        ? {
            date: highestRevenueDay.date,

            totalOrders: highestRevenueDay.totalOrders,

            completedOrders: highestRevenueDay.completedOrders,

            revenue: highestRevenueDay.revenue,
          }
        : null,

      busiestDay: busiestDay
        ? {
            date: busiestDay.date,

            totalOrders: busiestDay.totalOrders,

            completedOrders: busiestDay.completedOrders,

            revenue: busiestDay.revenue,
          }
        : null,
    },

    days,
  };
};
