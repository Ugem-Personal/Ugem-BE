import { OrderPaymentStatus, OrderStatus, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
export const getMerchantDashboard = async (merchantId) => {
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
    const [totalOrders, pendingOrders, acceptedOrders, completedOrders, paidOrders, totalFoods, totalCampaigns, activeCampaigns,] = await prisma.$transaction([
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
    const totalRevenue = paidOrders.reduce((total, order) => total + Number(order.finalPrice), 0);
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
                status: OrderStatus.Accepted,
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
export const getReviewerDashboard = async (reviewerId) => {
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
    const [affiliateLinks, totalReviews, earningTransactions] = await prisma.$transaction([
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
    const totalClicks = affiliateLinks.reduce((total, link) => total + link.clickCount, 0);
    const successfulOrders = affiliateLinks.reduce((total, link) => total + link.successfulOrders, 0);
    const totalEarnings = earningTransactions.reduce((total, transaction) => total + Number(transaction.amount), 0);
    const activeLinks = affiliateLinks.filter((link) => link.isActive).length;
    const conversionRate = totalClicks > 0
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
export const getStaffDashboard = async () => {
    const [totalUsers, totalCustomers, totalMerchants, activeMerchants, totalReviewers, totalOrders, paidOrders, pendingReviewerApplications,] = await prisma.$transaction([
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
    const totalRevenue = paidOrders.reduce((total, order) => total + Number(order.finalPrice), 0);
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
export const getStaffRevenueByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalRevenue = months.reduce((total, month) => total + month.revenue, 0);
    return {
        year,
        summary: {
            totalRevenue,
            totalPaidOrders: paidOrders.length,
        },
        months,
    };
};
export const getMerchantRevenueByYear = async (merchantId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalRevenue = months.reduce((total, month) => total + month.revenue, 0);
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
export const getMerchantTopFoods = async (merchantId, limit) => {
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
    const foodStatistics = new Map();
    for (const detail of orderDetails) {
        const current = foodStatistics.get(detail.foodId);
        if (current) {
            current.quantitySold += detail.quantity;
            current.revenue += Number(detail.lineTotal);
        }
        else {
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
export const getMerchantRecentOrders = async (merchantId, limit) => {
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
            totalItems: order.details.reduce((total, detail) => total + detail.quantity, 0),
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
export const getReviewerRecentEarnings = async (reviewerId, limit) => {
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
export const getStaffRecentOrders = async (limit) => {
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
            totalItems: order.details.reduce((total, detail) => total + detail.quantity, 0),
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
export const getStaffTopMerchants = async (limit) => {
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
        const totalRevenue = merchant.orders.reduce((total, order) => total + Number(order.finalPrice), 0);
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
export const getStaffTopReviewers = async (limit) => {
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
        const totalClicks = reviewer.affiliateLinks.reduce((total, link) => total + link.clickCount, 0);
        const successfulOrders = reviewer.affiliateLinks.reduce((total, link) => total + link.successfulOrders, 0);
        const totalEarnings = reviewer.earningTransactions.reduce((total, transaction) => total + Number(transaction.amount), 0);
        const activeLinks = reviewer.affiliateLinks.filter((link) => link.isActive).length;
        const conversionRate = totalClicks > 0
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
export const getStaffTopFoods = async (limit) => {
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
    const foodStatistics = new Map();
    for (const detail of orderDetails) {
        const current = foodStatistics.get(detail.foodId);
        if (current) {
            current.quantitySold += detail.quantity;
            current.revenue += Number(detail.lineTotal);
            current.orderCount += 1;
        }
        else {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
export const getReviewerEarningsByYear = async (reviewerId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalEarnings = months.reduce((total, month) => total + month.earnings, 0);
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
            averageEarningPerTransaction: transactions.length > 0
                ? Number((totalEarnings / transactions.length).toFixed(2))
                : 0,
        },
        months,
    };
};
export const getStaffUserGrowthByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const summary = months.reduce((total, month) => ({
        totalUsers: total.totalUsers + month.totalUsers,
        customers: total.customers + month.customers,
        merchants: total.merchants + month.merchants,
        reviewers: total.reviewers + month.reviewers,
        staffs: total.staffs + month.staffs,
        admins: total.admins + month.admins,
    }), {
        totalUsers: 0,
        customers: 0,
        merchants: 0,
        reviewers: 0,
        staffs: 0,
        admins: 0,
    });
    return {
        year,
        summary,
        months,
    };
};
export const getStaffOrderGrowthByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
        year,
        summary,
        months,
    };
};
export const getMerchantOrderGrowthByYear = async (merchantId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
        merchant: {
            id: merchant.id,
            name: merchant.name,
        },
        year,
        summary,
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
export const getReviewerAffiliateGrowthByYear = async (reviewerId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const summary = months.reduce((total, month) => ({
        totalClicks: total.totalClicks + month.clicks,
        successfulOrders: total.successfulOrders + month.successfulOrders,
        totalEarnings: total.totalEarnings + month.earnings,
    }), {
        totalClicks: 0,
        successfulOrders: 0,
        totalEarnings: 0,
    });
    const conversionRate = summary.totalClicks > 0
        ? Number(((summary.successfulOrders / summary.totalClicks) * 100).toFixed(2))
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
export const getMerchantCampaignPerformance = async (merchantId, limit) => {
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
        const paidOrders = campaign.orders.filter((order) => order.paymentStatus === OrderPaymentStatus.Paid);
        const completedPaidOrders = paidOrders.filter((order) => order.status === OrderStatus.Completed);
        const totalRevenue = completedPaidOrders.reduce((total, order) => total + Number(order.finalPrice), 0);
        const totalDiscount = campaign.orders.reduce((total, order) => total + Number(order.discount), 0);
        const averageOrderValue = completedPaidOrders.length > 0
            ? Number((totalRevenue / completedPaidOrders.length).toFixed(2))
            : 0;
        let campaignStatus;
        if (!campaign.isActive) {
            campaignStatus = "Disabled";
        }
        else if (campaign.usageLimit !== null &&
            campaign.usedCount >= campaign.usageLimit) {
            campaignStatus = "OutOfUsage";
        }
        else if (now < campaign.startAt) {
            campaignStatus = "Upcoming";
        }
        else if (now > campaign.endAt) {
            campaignStatus = "Expired";
        }
        else {
            campaignStatus = "Active";
        }
        return {
            campaignId: campaign.id,
            name: campaign.name,
            description: campaign.description,
            discountType: campaign.discountType,
            discountValue: Number(campaign.discountValue),
            minimumOrderAmount: Number(campaign.minimumOrderAmount),
            maximumDiscount: campaign.maximumDiscount !== null
                ? Number(campaign.maximumDiscount)
                : null,
            usageLimit: campaign.usageLimit,
            usedCount: campaign.usedCount,
            remainingUsage: campaign.usageLimit !== null
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
export const getMerchantReviewStatistics = async (merchantId) => {
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
    const calculatePercentage = (count) => {
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
    const averageRating = totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;
    const calculatePercentage = (count) => {
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
export const getStaffPaymentStatisticsByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalPaidOrders = Object.values(paymentMethods).reduce((total, method) => total + method.paidOrders, 0);
    const totalRevenue = Object.values(paymentMethods).reduce((total, method) => total + method.revenue, 0);
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
export const getMerchantPaymentStatisticsByYear = async (merchantId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalPaidOrders = Object.values(paymentMethods).reduce((total, method) => total + method.paidOrders, 0);
    const totalRevenue = Object.values(paymentMethods).reduce((total, method) => total + method.revenue, 0);
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
export const getMerchantCustomerStatisticsByYear = async (merchantId, year, limit) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const customerMap = new Map();
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
                totalSpending: order.paymentStatus === OrderPaymentStatus.Paid &&
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
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
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
    const returningCustomers = customers.filter((customer) => customer.totalOrders >= 2);
    const oneTimeCustomers = customers.filter((customer) => customer.totalOrders === 1);
    const newCustomers = customers.filter((customer) => customer.accountCreatedAt >= startDate &&
        customer.accountCreatedAt < endDate);
    const totalRevenue = customers.reduce((total, customer) => total + customer.totalSpending, 0);
    const averageSpendingPerCustomer = customers.length > 0
        ? Number((totalRevenue / customers.length).toFixed(2))
        : 0;
    const returningCustomerRate = customers.length > 0
        ? Number(((returningCustomers.length / customers.length) * 100).toFixed(2))
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
export const getMerchantPeakHoursByYear = async (merchantId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
        const hourStatistics = hours[hourIndex];
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
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
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
    const totalCompletedOrders = hours.reduce((total, hour) => total + hour.completedOrders, 0);
    const totalPaidOrders = hours.reduce((total, hour) => total + hour.paidOrders, 0);
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
export const getMerchantWeekdayStatisticsByYear = async (merchantId, year) => {
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
        if (order.paymentStatus === OrderPaymentStatus.Paid) {
            weekday.paidOrders += 1;
        }
        if (order.status === OrderStatus.Completed &&
            order.paymentStatus === OrderPaymentStatus.Paid) {
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
    const totalCompletedOrders = weekdays.reduce((total, weekday) => total + weekday.completedOrders, 0);
    const totalPaidOrders = weekdays.reduce((total, weekday) => total + weekday.paidOrders, 0);
    const totalRevenue = weekdays.reduce((total, weekday) => total + weekday.revenue, 0);
    const peakWeekday = weekdays.reduce((currentPeak, weekday) => {
        if (weekday.totalOrders > currentPeak.totalOrders) {
            return weekday;
        }
        return currentPeak;
    }, weekdays[0]);
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
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
export const getStaffPeakHoursByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalCompletedOrders = hours.reduce((total, hour) => total + hour.completedOrders, 0);
    const totalPaidOrders = hours.reduce((total, hour) => total + hour.paidOrders, 0);
    const totalRejectedOrders = hours.reduce((total, hour) => total + hour.rejectedOrders, 0);
    const totalRevenue = hours.reduce((total, hour) => total + hour.revenue, 0);
    const averageOrderValue = totalCompletedOrders > 0
        ? Number((totalRevenue / totalCompletedOrders).toFixed(2))
        : 0;
    const peakHour = totalOrders > 0
        ? hours.reduce((currentPeak, hour) => hour.totalOrders > currentPeak.totalOrders ? hour : currentPeak, hours[0])
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
export const getStaffWeekdayStatisticsByYear = async (year) => {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
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
    const totalCompletedOrders = weekdays.reduce((total, weekday) => total + weekday.completedOrders, 0);
    const totalRejectedOrders = weekdays.reduce((total, weekday) => total + weekday.rejectedOrders, 0);
    const totalPaidOrders = weekdays.reduce((total, weekday) => total + weekday.paidOrders, 0);
    const totalRevenue = weekdays.reduce((total, weekday) => total + weekday.revenue, 0);
    const averageOrderValue = totalCompletedOrders > 0
        ? Number((totalRevenue / totalCompletedOrders).toFixed(2))
        : 0;
    const peakWeekday = totalOrders > 0
        ? weekdays.reduce((currentPeak, weekday) => weekday.totalOrders > currentPeak.totalOrders
            ? weekday
            : currentPeak, weekdays[0])
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
