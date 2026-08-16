import crypto from "node:crypto";
import { MerchantStatus, UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { getReviewerCommissionRate } from "../../common/utils/reviewer-rank.js";
const affiliateLinkInclude = {
    merchant: {
        select: {
            id: true,
            name: true,
            logoUrl: true,
            address: true,
            rating: true,
            reviewCount: true,
            status: true,
        },
    },
};
const mapAffiliateLink = (link) => ({
    id: link.id,
    affiliateLinkId: link.id,
    reviewerId: link.reviewerId,
    merchantId: link.merchantId,
    linkCode: link.linkCode,
    affiliateCode: link.linkCode,
    /*
     * Field FE đang dùng để copy và chia sẻ link.
     */
    url: buildAffiliateShareUrl(link.linkCode),
    clickCount: link.clickCount,
    successfulOrders: link.successfulOrders,
    totalEarnings: Number(link.totalEarnings),
    isActive: link.isActive,
    merchant: link.merchant
        ? {
            ...link.merchant,
            rating: Number(link.merchant.rating),
        }
        : null,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
});
const createLinkCode = () => {
    return crypto.randomBytes(8).toString("hex").toUpperCase();
};
const hashIp = (ipAddress) => {
    if (!ipAddress) {
        return null;
    }
    return crypto.createHash("sha256").update(ipAddress).digest("hex");
};
const getFrontendOrigin = () => {
    return env.FRONTEND_URL.replace(/\/$/, "");
};
const buildAffiliateShareUrl = (linkCode) => {
    return `${getFrontendOrigin()}/r/${encodeURIComponent(linkCode)}`;
};
export const createAffiliateLink = async (reviewerId, input) => {
    const reviewer = await prisma.customer.findUnique({
        where: {
            id: reviewerId,
        },
        include: {
            user: true,
        },
    });
    if (!reviewer) {
        throw new AppError(404, "Không tìm thấy Reviewer");
    }
    if (reviewer.user.role !== UserRole.Reviewer) {
        throw new AppError(403, "Tài khoản chưa phải Reviewer");
    }
    const merchant = await prisma.merchant.findFirst({
        where: {
            id: input.merchantId,
            status: MerchantStatus.Active,
        },
    });
    if (!merchant) {
        throw new AppError(404, "Không tìm thấy Merchant");
    }
    const existing = await prisma.affiliateLink.findUnique({
        where: {
            reviewerId_merchantId: {
                reviewerId,
                merchantId: input.merchantId,
            },
        },
        include: affiliateLinkInclude,
    });
    if (existing) {
        if (!existing.isActive) {
            const reactivated = await prisma.affiliateLink.update({
                where: {
                    id: existing.id,
                },
                data: {
                    isActive: true,
                },
                include: affiliateLinkInclude,
            });
            return mapAffiliateLink(reactivated);
        }
        throw new AppError(409, "Bạn đã có affiliate link cho Merchant này");
    }
    let linkCode = createLinkCode();
    while (await prisma.affiliateLink.findUnique({
        where: {
            linkCode,
        },
    })) {
        linkCode = createLinkCode();
    }
    const link = await prisma.affiliateLink.create({
        data: {
            reviewerId,
            merchantId: input.merchantId,
            linkCode,
        },
        include: affiliateLinkInclude,
    });
    return mapAffiliateLink(link);
};
export const getMyAffiliateLinks = async (reviewerId) => {
    const links = await prisma.affiliateLink.findMany({
        where: {
            reviewerId,
        },
        include: affiliateLinkInclude,
        orderBy: {
            createdAt: "desc",
        },
    });
    return links.map(mapAffiliateLink);
};
export const updateAffiliateLinkStatus = async (reviewerId, linkId, input) => {
    const link = await prisma.affiliateLink.findUnique({
        where: {
            id: linkId,
        },
    });
    if (!link) {
        throw new AppError(404, "Không tìm thấy Affiliate Link");
    }
    if (link.reviewerId !== reviewerId) {
        throw new AppError(403, "Bạn không có quyền sửa Affiliate Link này");
    }
    const updated = await prisma.affiliateLink.update({
        where: {
            id: linkId,
        },
        data: {
            isActive: input.isActive,
        },
        include: affiliateLinkInclude,
    });
    return mapAffiliateLink(updated);
};
export const trackAffiliateLink = async (code, context) => {
    const link = await prisma.affiliateLink.findUnique({
        where: {
            linkCode: code.trim().toUpperCase(),
        },
        include: affiliateLinkInclude,
    });
    if (!link || !link.isActive) {
        throw new AppError(404, "Affiliate Link không tồn tại hoặc đã bị khóa");
    }
    if (link.merchant.status !== MerchantStatus.Active) {
        throw new AppError(409, "Merchant hiện không hoạt động");
    }
    const ipHash = hashIp(context.ipAddress);
    await prisma.$transaction(async (transaction) => {
        const reviewer = await transaction.customer.update({
            where: { id: link.reviewerId },
            data: { reviewerPoints: { increment: 1 } },
            select: { reviewerPoints: true },
        });
        await transaction.affiliateClick.create({
            data: {
                affiliateLinkId: link.id,
                customerId: context.customerId ?? null,
                ipHash,
                userAgent: context.userAgent ?? null,
            },
        });
        await transaction.affiliateLink.update({
            where: {
                id: link.id,
            },
            data: {
                clickCount: {
                    increment: 1,
                },
            },
        });
        await transaction.reviewerPointTransaction.create({
            data: {
                reviewerId: link.reviewerId,
                amount: 1,
                pointsAfter: reviewer.reviewerPoints,
                type: "AffiliateClick",
                reason: `Click từ Affiliate Link ${link.linkCode}`,
                referenceId: link.id,
            },
        });
    });
    return {
        affiliateLinkId: link.id,
        linkCode: link.linkCode,
        url: buildAffiliateShareUrl(link.linkCode),
        merchantId: link.merchantId,
        merchant: {
            ...link.merchant,
            rating: Number(link.merchant.rating),
        },
    };
};
export const getReviewerEarnings = async (reviewerId, query) => {
    const pageIndex = query.pageIndex || 1;
    const pageSize = query.pageSize || 10;
    const reviewer = await prisma.customer.findUnique({
        where: {
            id: reviewerId,
        },
        select: {
            id: true,
            user: {
                select: {
                    role: true,
                },
            },
            reviewerPoints: true,
            reviewerRank: true,
        },
    });
    if (!reviewer) {
        throw new AppError(404, "Không tìm thấy Reviewer");
    }
    if (reviewer.user.role !== UserRole.Reviewer) {
        throw new AppError(403, "Tài khoản chưa phải Reviewer");
    }
    const links = await prisma.affiliateLink.findMany({
        where: {
            reviewerId,
        },
        select: {
            totalEarnings: true,
            clickCount: true,
            successfulOrders: true,
        },
    });
    const affiliateLinkCount = links.length;
    const totalClicks = links.reduce((total, link) => total + link.clickCount, 0);
    const commissionOrderCount = links.reduce((total, link) => total + link.successfulOrders, 0);
    const [allTransactionSummary, transactions, totalItems, pointTransactions] = await prisma.$transaction([
        prisma.reviewerEarningTransaction.findMany({
            where: {
                reviewerId,
            },
            select: {
                amount: true,
                earningsAfter: true,
                type: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        }),
        prisma.reviewerEarningTransaction.findMany({
            where: {
                reviewerId,
            },
            include: {
                order: {
                    select: {
                        id: true,
                        merchantId: true,
                        finalPrice: true,
                        reviewerCommission: true,
                        completedAt: true,
                        createdAt: true,
                        merchant: {
                            select: {
                                id: true,
                                name: true,
                                logoUrl: true,
                            },
                        },
                    },
                },
                booking: {
                    select: {
                        id: true,
                        merchantId: true,
                        partySize: true,
                        createdAt: true,
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
            orderBy: {
                createdAt: "desc",
            },
            skip: (pageIndex - 1) * pageSize,
            take: pageSize,
        }),
        prisma.reviewerEarningTransaction.count({
            where: {
                reviewerId,
            },
        }),
        prisma.reviewerPointTransaction.findMany({
            where: { reviewerId },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
    ]);
    const totalCommission = allTransactionSummary.reduce((total, transaction) => {
        const amount = Number(transaction.amount);
        return amount > 0 ? total + amount : total;
    }, 0);
    const totalReversal = allTransactionSummary.reduce((total, transaction) => {
        const amount = Number(transaction.amount);
        return amount < 0 ? total + Math.abs(amount) : total;
    }, 0);
    const netEarnings = Number((totalCommission - totalReversal).toFixed(2));
    const currentEarnings = allTransactionSummary.length > 0
        ? Number(allTransactionSummary[allTransactionSummary.length - 1]
            .earningsAfter)
        : 0;
    const commissionRate = getReviewerCommissionRate(reviewer.reviewerRank) * 100;
    const points = reviewer.reviewerPoints;
    const rank = reviewer.reviewerRank;
    const recentTransactions = transactions.map((transaction) => ({
        transactionId: transaction.id,
        orderId: transaction.orderId,
        bookingId: transaction.bookingId,
        amount: Number(transaction.amount),
        type: transaction.type,
        earningsAfter: Number(transaction.earningsAfter),
        createdAtUtc: transaction.createdAt.toISOString(),
        reason: transaction.reason,
        id: transaction.id,
        createdAt: transaction.createdAt,
        order: transaction.order
            ? {
                ...transaction.order,
                finalPrice: Number(transaction.order.finalPrice),
                reviewerCommission: Number(transaction.order.reviewerCommission),
            }
            : null,
        booking: transaction.booking
            ? {
                ...transaction.booking,
            }
            : null,
    }));
    return {
        reviewerId,
        points,
        rank,
        currentEarnings,
        totalCommission,
        totalReversal,
        netEarnings,
        commissionRate,
        affiliateLinkCount,
        totalClicks,
        commissionOrderCount,
        recentTransactions,
        pointTransactions,
        /*
         * Giữ contract cũ để không phá code khác.
         */
        summary: {
            totalEarnings: netEarnings,
            totalClicks,
            successfulOrders: commissionOrderCount,
            conversionRate: totalClicks > 0
                ? Number(((commissionOrderCount / totalClicks) * 100).toFixed(2))
                : 0,
        },
        transactions: recentTransactions,
        totalItems,
        pageIndex,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
    };
};
