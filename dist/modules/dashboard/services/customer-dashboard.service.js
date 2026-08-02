import { OrderPaymentStatus, OrderStatus, } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../common/errors/app-error.js";
import { createDateKeys, getVietnamDateRange, getYearRange, toVietnamDateKey, } from "../utils/dashboard-date.util.js";
export const getCustomerDashboard = async (customerId) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const [totalOrders, pendingOrders, acceptedOrders, completedOrders, paidOrders, totalWishlists, totalReviews,] = await prisma.$transaction([
        prisma.order.count({
            where: {
                customerId,
            },
        }),
        prisma.order.count({
            where: {
                customerId,
                status: OrderStatus.Pending,
            },
        }),
        prisma.order.count({
            where: {
                customerId,
                status: {
                    in: [
                        OrderStatus.Accepted,
                        OrderStatus.Preparing,
                        OrderStatus.Ready,
                        OrderStatus.Delivering,
                    ],
                },
            },
        }),
        prisma.order.count({
            where: {
                customerId,
                status: OrderStatus.Completed,
            },
        }),
        prisma.order.findMany({
            where: {
                customerId,
                paymentStatus: OrderPaymentStatus.Paid,
            },
            select: {
                finalPrice: true,
            },
        }),
        prisma.wishlist.count({
            where: {
                customerId,
            },
        }),
        prisma.review.count({
            where: {
                customerId,
            },
        }),
    ]);
    const totalSpent = paidOrders.reduce((total, order) => total + Number(order.finalPrice), 0);
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
            avatarUrl: customer.user.avatarUrl,
        },
        orders: {
            total: totalOrders,
            pending: pendingOrders,
            accepted: acceptedOrders,
            completed: completedOrders,
            paid: paidOrders.length,
        },
        spending: {
            total: totalSpent,
        },
        wishlists: {
            total: totalWishlists,
        },
        reviews: {
            total: totalReviews,
        },
    };
};
export const getCustomerRecentOrders = async (customerId, limit) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
            deliveryAddress: true,
            notes: true,
            campaignId: true,
            affiliateLinkId: true,
            reviewerCommission: true,
            orderedAt: true,
            acceptedAt: true,
            rejectedAt: true,
            completedAt: true,
            rejectionReason: true,
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    phone: true,
                    address: true,
                    rating: true,
                    reviewCount: true,
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
                    toppings: {
                        select: {
                            id: true,
                            toppingId: true,
                            toppingNameSnapshot: true,
                            priceSnapshot: true,
                        },
                    },
                },
            },
            bill: {
                select: {
                    id: true,
                    status: true,
                    method: true,
                    amount: true,
                },
            },
            review: {
                select: {
                    id: true,
                    rating: true,
                    content: true,
                    createdAt: true,
                },
            },
        },
        orderBy: {
            orderedAt: "desc",
        },
        take: limit,
    });
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
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
            campaignId: order.campaignId,
            affiliateLinkId: order.affiliateLinkId,
            reviewerCommission: Number(order.reviewerCommission),
            deliveryAddress: order.deliveryAddress,
            notes: order.notes,
            rejectionReason: order.rejectionReason,
            totalItems: order.details.reduce((total, detail) => total + detail.quantity, 0),
            merchant: {
                ...order.merchant,
                rating: Number(order.merchant.rating),
            },
            foods: order.details.map((detail) => ({
                orderDetailId: detail.id,
                foodId: detail.foodId,
                foodName: detail.foodNameSnapshot,
                quantity: detail.quantity,
                unitPrice: Number(detail.unitPrice),
                lineTotal: Number(detail.lineTotal),
                toppings: detail.toppings.map((topping) => ({
                    id: topping.id,
                    toppingId: topping.toppingId,
                    toppingName: topping.toppingNameSnapshot,
                    price: Number(topping.priceSnapshot),
                })),
            })),
            bill: order.bill
                ? {
                    id: order.bill.id,
                    status: order.bill.status,
                    method: order.bill.method,
                    amount: Number(order.bill.amount),
                }
                : null,
            review: order.review,
            orderedAt: order.orderedAt,
            acceptedAt: order.acceptedAt,
            rejectedAt: order.rejectedAt,
            completedAt: order.completedAt,
        })),
    };
};
export const getCustomerSpendingByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const paidOrders = await prisma.order.findMany({
        where: {
            customerId,
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
        spending: 0,
        paidOrders: 0,
    }));
    for (const order of paidOrders) {
        const monthIndex = order.createdAt.getUTCMonth();
        const monthSummary = months[monthIndex];
        if (!monthSummary) {
            continue;
        }
        monthSummary.spending += Number(order.finalPrice);
        monthSummary.paidOrders += 1;
    }
    const totalSpending = months.reduce((total, month) => total + month.spending, 0);
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        summary: {
            totalSpending,
            totalPaidOrders: paidOrders.length,
            averageOrderValue: paidOrders.length > 0
                ? Number((totalSpending / paidOrders.length).toFixed(2))
                : 0,
        },
        months,
    };
};
export const getCustomerOrderGrowthByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
    const summary = months.reduce((total, month) => ({
        totalOrders: total.totalOrders + month.totalOrders,
        pending: total.pending + month.pending,
        accepted: total.accepted + month.accepted,
        completed: total.completed + month.completed,
        rejected: total.rejected + month.rejected,
        paid: total.paid + month.paid,
    }), {
        totalOrders: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        rejected: 0,
        paid: 0,
    });
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        summary,
        months,
    };
};
export const getCustomerPaymentStatisticsByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
            spending: 0,
            percentage: 0,
        },
        COD: {
            totalOrders: 0,
            paidOrders: 0,
            spending: 0,
            percentage: 0,
        },
        BankTransfer: {
            totalOrders: 0,
            paidOrders: 0,
            spending: 0,
            percentage: 0,
        },
    };
    const months = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        Cash: {
            orders: 0,
            paidOrders: 0,
            spending: 0,
        },
        COD: {
            orders: 0,
            paidOrders: 0,
            spending: 0,
        },
        BankTransfer: {
            orders: 0,
            paidOrders: 0,
            spending: 0,
        },
    }));
    for (const order of orders) {
        const paymentMethod = order.paymentMethod;
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
            const spending = Number(order.finalPrice);
            methodStatistics.paidOrders += 1;
            methodStatistics.spending += spending;
            monthMethodStatistics.paidOrders += 1;
            monthMethodStatistics.spending += spending;
        }
    }
    const totalOrders = orders.length;
    for (const method of Object.values(paymentMethods)) {
        method.percentage =
            totalOrders > 0
                ? Number(((method.totalOrders / totalOrders) * 100).toFixed(2))
                : 0;
    }
    const totalPaidOrders = Object.values(paymentMethods).reduce((total, method) => total + method.paidOrders, 0);
    const totalSpending = Object.values(paymentMethods).reduce((total, method) => total + method.spending, 0);
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        summary: {
            totalOrders,
            totalPaidOrders,
            totalSpending,
        },
        paymentMethods,
        months,
    };
};
export const getCustomerFavoriteMerchantsByYear = async (customerId, year, limit) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
            createdAt: {
                gte: startDate,
                lt: endDate,
            },
        },
        select: {
            id: true,
            merchantId: true,
            status: true,
            paymentStatus: true,
            finalPrice: true,
            createdAt: true,
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    address: true,
                    phone: true,
                    rating: true,
                    reviewCount: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    const merchantMap = new Map();
    for (const order of orders) {
        const existingMerchant = merchantMap.get(order.merchantId);
        if (!existingMerchant) {
            merchantMap.set(order.merchantId, {
                merchantId: order.merchant.id,
                name: order.merchant.name,
                logoUrl: order.merchant.logoUrl,
                address: order.merchant.address,
                phone: order.merchant.phone,
                rating: Number(order.merchant.rating),
                reviewCount: order.merchant.reviewCount,
                totalOrders: 1,
                completedOrders: order.status === OrderStatus.Completed ? 1 : 0,
                paidOrders: order.paymentStatus === OrderPaymentStatus.Paid ? 1 : 0,
                totalSpending: order.status === OrderStatus.Completed &&
                    order.paymentStatus === OrderPaymentStatus.Paid
                    ? Number(order.finalPrice)
                    : 0,
                firstOrderAt: order.createdAt,
                latestOrderAt: order.createdAt,
            });
            continue;
        }
        existingMerchant.totalOrders += 1;
        if (order.status === OrderStatus.Completed) {
            existingMerchant.completedOrders += 1;
        }
        if (order.paymentStatus === OrderPaymentStatus.Paid) {
            existingMerchant.paidOrders += 1;
        }
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
            existingMerchant.totalSpending += Number(order.finalPrice);
        }
        if (order.createdAt < existingMerchant.firstOrderAt) {
            existingMerchant.firstOrderAt = order.createdAt;
        }
        if (order.createdAt > existingMerchant.latestOrderAt) {
            existingMerchant.latestOrderAt = order.createdAt;
        }
    }
    const merchants = Array.from(merchantMap.values());
    const totalSpending = merchants.reduce((total, merchant) => total + merchant.totalSpending, 0);
    const completedOrders = merchants.reduce((total, merchant) => total + merchant.completedOrders, 0);
    const favoriteMerchants = merchants
        .sort((first, second) => {
        if (second.totalOrders !== first.totalOrders) {
            return second.totalOrders - first.totalOrders;
        }
        return second.totalSpending - first.totalSpending;
    })
        .slice(0, limit)
        .map((merchant, index) => ({
        rank: index + 1,
        merchantId: merchant.merchantId,
        name: merchant.name,
        logoUrl: merchant.logoUrl,
        address: merchant.address,
        phone: merchant.phone,
        rating: merchant.rating,
        reviewCount: merchant.reviewCount,
        totalOrders: merchant.totalOrders,
        completedOrders: merchant.completedOrders,
        paidOrders: merchant.paidOrders,
        totalSpending: Number(merchant.totalSpending.toFixed(2)),
        averageOrderValue: merchant.completedOrders > 0
            ? Number((merchant.totalSpending / merchant.completedOrders).toFixed(2))
            : 0,
        firstOrderAt: merchant.firstOrderAt,
        latestOrderAt: merchant.latestOrderAt,
    }));
    const favoriteMerchant = favoriteMerchants.length > 0 ? favoriteMerchants[0] : null;
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        limit,
        summary: {
            totalMerchants: merchants.length,
            totalOrders: orders.length,
            completedOrders,
            totalSpending,
            favoriteMerchant: favoriteMerchant
                ? {
                    merchantId: favoriteMerchant.merchantId,
                    name: favoriteMerchant.name,
                    totalOrders: favoriteMerchant.totalOrders,
                    totalSpending: favoriteMerchant.totalSpending,
                }
                : null,
        },
        favoriteMerchants,
    };
};
export const getCustomerWeekdayStatisticsByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
            spending: 0,
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
            spending: 0,
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
            spending: 0,
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
            spending: 0,
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
            spending: 0,
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
            spending: 0,
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
            spending: 0,
            averageOrderValue: 0,
            percentage: 0,
        },
    ];
    for (const order of orders) {
        const vietnamDate = new Date(order.createdAt.getTime() + 7 * 60 * 60 * 1000);
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
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
            weekday.spending += Number(order.finalPrice);
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
                ? Number((weekday.spending / weekday.completedOrders).toFixed(2))
                : 0;
    }
    const totalCompletedOrders = weekdays.reduce((total, weekday) => total + weekday.completedOrders, 0);
    const totalRejectedOrders = weekdays.reduce((total, weekday) => total + weekday.rejectedOrders, 0);
    const totalPaidOrders = weekdays.reduce((total, weekday) => total + weekday.paidOrders, 0);
    const totalSpending = weekdays.reduce((total, weekday) => total + weekday.spending, 0);
    const averageOrderValue = totalCompletedOrders > 0
        ? Number((totalSpending / totalCompletedOrders).toFixed(2))
        : 0;
    const favoriteWeekday = totalOrders > 0
        ? weekdays.reduce((currentFavorite, weekday) => weekday.totalOrders > currentFavorite.totalOrders
            ? weekday
            : currentFavorite, weekdays[0])
        : null;
    const ranking = [...weekdays]
        .sort((first, second) => second.totalOrders - first.totalOrders)
        .map((weekday, index) => ({
        rank: index + 1,
        ...weekday,
    }));
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        timezone: "Asia/Ho_Chi_Minh",
        summary: {
            totalOrders,
            totalCompletedOrders,
            totalRejectedOrders,
            totalPaidOrders,
            totalSpending,
            averageOrderValue,
            favoriteWeekday: favoriteWeekday
                ? {
                    dayIndex: favoriteWeekday.dayIndex,
                    dayName: favoriteWeekday.dayName,
                    totalOrders: favoriteWeekday.totalOrders,
                    completedOrders: favoriteWeekday.completedOrders,
                    spending: favoriteWeekday.spending,
                    percentage: favoriteWeekday.percentage,
                }
                : null,
        },
        ranking,
        weekdays,
    };
};
export const getCustomerPeakHoursByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
        rejectedOrders: 0,
        paidOrders: 0,
        spending: 0,
        averageOrderValue: 0,
        percentage: 0,
    }));
    for (const order of orders) {
        // Chuyển giờ UTC sang giờ Việt Nam UTC+7
        const hourIndex = (order.createdAt.getUTCHours() + 7) % 24;
        const hourStatistics = hours[hourIndex];
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
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
            hourStatistics.spending += Number(order.finalPrice);
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
                ? Number((hour.spending / hour.completedOrders).toFixed(2))
                : 0;
    }
    const totalCompletedOrders = hours.reduce((total, hour) => total + hour.completedOrders, 0);
    const totalRejectedOrders = hours.reduce((total, hour) => total + hour.rejectedOrders, 0);
    const totalPaidOrders = hours.reduce((total, hour) => total + hour.paidOrders, 0);
    const totalSpending = hours.reduce((total, hour) => total + hour.spending, 0);
    const averageOrderValue = totalCompletedOrders > 0
        ? Number((totalSpending / totalCompletedOrders).toFixed(2))
        : 0;
    const favoriteHour = totalOrders > 0
        ? hours.reduce((currentFavorite, hour) => hour.totalOrders > currentFavorite.totalOrders
            ? hour
            : currentFavorite, hours[0])
        : null;
    const topHours = [...hours]
        .sort((first, second) => second.totalOrders - first.totalOrders)
        .slice(0, 5)
        .map((hour, index) => ({
        rank: index + 1,
        ...hour,
    }));
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        timezone: "Asia/Ho_Chi_Minh",
        summary: {
            totalOrders,
            totalCompletedOrders,
            totalRejectedOrders,
            totalPaidOrders,
            totalSpending,
            averageOrderValue,
            favoriteHour: favoriteHour
                ? {
                    hour: favoriteHour.hour,
                    timeRange: favoriteHour.timeRange,
                    totalOrders: favoriteHour.totalOrders,
                    completedOrders: favoriteHour.completedOrders,
                    spending: favoriteHour.spending,
                    percentage: favoriteHour.percentage,
                }
                : null,
        },
        topHours,
        hours,
    };
};
export const getCustomerOrderPerformanceByYear = async (customerId, year) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    const { startDate, endDate } = getYearRange(year);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
        spending: 0,
        completionRate: 0,
        rejectionRate: 0,
        paymentRate: 0,
    }));
    for (const order of orders) {
        const monthIndex = order.createdAt.getUTCMonth();
        const month = months[monthIndex];
        month.totalOrders += 1;
        switch (order.status) {
            case OrderStatus.Pending:
                month.pendingOrders += 1;
                break;
            case OrderStatus.Accepted:
            case OrderStatus.Preparing:
            case OrderStatus.Ready:
            case OrderStatus.Delivering:
                month.acceptedOrders += 1;
                break;
            case OrderStatus.Completed:
                month.completedOrders += 1;
                break;
            case OrderStatus.Rejected:
                month.rejectedOrders += 1;
                break;
        }
        if (order.paymentStatus === OrderPaymentStatus.Paid) {
            month.paidOrders += 1;
        }
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
            month.spending += Number(order.finalPrice);
        }
    }
    for (const month of months) {
        if (month.totalOrders === 0) {
            continue;
        }
        month.completionRate = Number(((month.completedOrders / month.totalOrders) * 100).toFixed(2));
        month.rejectionRate = Number(((month.rejectedOrders / month.totalOrders) * 100).toFixed(2));
        month.paymentRate = Number(((month.paidOrders / month.totalOrders) * 100).toFixed(2));
    }
    const summary = months.reduce((total, month) => ({
        totalOrders: total.totalOrders + month.totalOrders,
        pendingOrders: total.pendingOrders + month.pendingOrders,
        acceptedOrders: total.acceptedOrders + month.acceptedOrders,
        completedOrders: total.completedOrders + month.completedOrders,
        rejectedOrders: total.rejectedOrders + month.rejectedOrders,
        paidOrders: total.paidOrders + month.paidOrders,
        totalSpending: total.totalSpending + month.spending,
    }), {
        totalOrders: 0,
        pendingOrders: 0,
        acceptedOrders: 0,
        completedOrders: 0,
        rejectedOrders: 0,
        paidOrders: 0,
        totalSpending: 0,
    });
    const completionRate = summary.totalOrders > 0
        ? Number(((summary.completedOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const rejectionRate = summary.totalOrders > 0
        ? Number(((summary.rejectedOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const paymentRate = summary.totalOrders > 0
        ? Number(((summary.paidOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const averageOrderValue = summary.completedOrders > 0
        ? Number((summary.totalSpending / summary.completedOrders).toFixed(2))
        : 0;
    const highestSpendingMonth = summary.totalOrders > 0
        ? months.reduce((currentHighest, month) => month.spending > currentHighest.spending ? month : currentHighest, months[0])
        : null;
    const mostActiveMonth = summary.totalOrders > 0
        ? months.reduce((currentHighest, month) => month.totalOrders > currentHighest.totalOrders
            ? month
            : currentHighest, months[0])
        : null;
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        year,
        summary: {
            ...summary,
            completionRate,
            rejectionRate,
            paymentRate,
            averageOrderValue,
            highestSpendingMonth: highestSpendingMonth
                ? {
                    month: highestSpendingMonth.month,
                    totalOrders: highestSpendingMonth.totalOrders,
                    completedOrders: highestSpendingMonth.completedOrders,
                    spending: highestSpendingMonth.spending,
                }
                : null,
            mostActiveMonth: mostActiveMonth
                ? {
                    month: mostActiveMonth.month,
                    totalOrders: mostActiveMonth.totalOrders,
                    completedOrders: mostActiveMonth.completedOrders,
                    spending: mostActiveMonth.spending,
                }
                : null,
        },
        months,
    };
};
export const getCustomerDailySpending = async (customerId, startDateValue, endDateValue) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
    if (!customer) {
        throw new AppError(404, "Không tìm thấy Customer");
    }
    /*
     * Query được hiểu theo ngày tại Việt Nam.
     * Ví dụ ngày 2026-07-01 bắt đầu tại 00:00 UTC+7.
     */
    const { startDate, endDate } = getVietnamDateRange(startDateValue, endDateValue);
    const orders = await prisma.order.findMany({
        where: {
            customerId,
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
            spending: 0,
            averageOrderValue: 0,
            completionRate: 0,
            rejectionRate: 0,
            paymentRate: 0,
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
            case OrderStatus.Preparing:
            case OrderStatus.Ready:
            case OrderStatus.Delivering:
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
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
            day.spending += Number(order.finalPrice);
        }
    }
    for (const day of days) {
        day.averageOrderValue =
            day.completedOrders > 0
                ? Number((day.spending / day.completedOrders).toFixed(2))
                : 0;
        day.completionRate =
            day.totalOrders > 0
                ? Number(((day.completedOrders / day.totalOrders) * 100).toFixed(2))
                : 0;
        day.rejectionRate =
            day.totalOrders > 0
                ? Number(((day.rejectedOrders / day.totalOrders) * 100).toFixed(2))
                : 0;
        day.paymentRate =
            day.totalOrders > 0
                ? Number(((day.paidOrders / day.totalOrders) * 100).toFixed(2))
                : 0;
    }
    const summary = days.reduce((total, day) => ({
        totalOrders: total.totalOrders + day.totalOrders,
        pendingOrders: total.pendingOrders + day.pendingOrders,
        acceptedOrders: total.acceptedOrders + day.acceptedOrders,
        completedOrders: total.completedOrders + day.completedOrders,
        rejectedOrders: total.rejectedOrders + day.rejectedOrders,
        paidOrders: total.paidOrders + day.paidOrders,
        totalSpending: total.totalSpending + day.spending,
    }), {
        totalOrders: 0,
        pendingOrders: 0,
        acceptedOrders: 0,
        completedOrders: 0,
        rejectedOrders: 0,
        paidOrders: 0,
        totalSpending: 0,
    });
    const averageOrderValue = summary.completedOrders > 0
        ? Number((summary.totalSpending / summary.completedOrders).toFixed(2))
        : 0;
    const completionRate = summary.totalOrders > 0
        ? Number(((summary.completedOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const rejectionRate = summary.totalOrders > 0
        ? Number(((summary.rejectedOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const paymentRate = summary.totalOrders > 0
        ? Number(((summary.paidOrders / summary.totalOrders) * 100).toFixed(2))
        : 0;
    const highestSpendingDay = summary.totalSpending > 0
        ? days.reduce((currentHighest, day) => day.spending > currentHighest.spending ? day : currentHighest, days[0])
        : null;
    const busiestDay = summary.totalOrders > 0
        ? days.reduce((currentHighest, day) => day.totalOrders > currentHighest.totalOrders
            ? day
            : currentHighest, days[0])
        : null;
    return {
        customer: {
            id: customer.id,
            userId: customer.user.id,
            fullName: customer.user.fullName,
            email: customer.user.email,
        },
        startDate: startDateValue,
        endDate: endDateValue,
        timezone: "Asia/Ho_Chi_Minh",
        summary: {
            ...summary,
            averageOrderValue,
            completionRate,
            rejectionRate,
            paymentRate,
            highestSpendingDay: highestSpendingDay
                ? {
                    date: highestSpendingDay.date,
                    totalOrders: highestSpendingDay.totalOrders,
                    completedOrders: highestSpendingDay.completedOrders,
                    spending: highestSpendingDay.spending,
                }
                : null,
            busiestDay: busiestDay
                ? {
                    date: busiestDay.date,
                    totalOrders: busiestDay.totalOrders,
                    completedOrders: busiestDay.completedOrders,
                    spending: busiestDay.spending,
                }
                : null,
        },
        days,
    };
};
