import { NotificationType, OrderPaymentStatus, OrderStatus, Prisma, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createNotification } from "../notifications/notification.service.js";
import { calculateReviewerRank } from "../../common/utils/reviewer-rank.js";
const REVIEWER_COMMISSION_PERCENT = 5;
export const REVIEWER_COMMISSION_RATE = 0.05;
export const createReviewerCommission = async (orderId) => {
    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        },
        include: {
            affiliateLink: {
                include: {
                    reviewer: {
                        select: {
                            userId: true,
                        },
                    },
                },
            },
            earningTransaction: true,
        },
    });
    if (!order) {
        throw new AppError(404, "Không tìm thấy Order");
    }
    if (!order.affiliateLink) {
        return null;
    }
    if (order.earningTransaction) {
        return order.earningTransaction;
    }
    if (order.status !== OrderStatus.Completed) {
        throw new AppError(409, "Order chưa hoàn thành");
    }
    if (order.paymentStatus !== OrderPaymentStatus.Paid) {
        throw new AppError(409, "Order chưa thanh toán");
    }
    const commission = Number(order.finalPrice) * (REVIEWER_COMMISSION_PERCENT / 100);
    const earningTransaction = await prisma.$transaction(async (transaction) => {
        const currentAggregate = await transaction.reviewerEarningTransaction.aggregate({
            where: {
                reviewerId: order.affiliateLink.reviewerId,
            },
            _sum: {
                amount: true,
            },
        });
        const currentEarnings = Number(currentAggregate._sum.amount ?? 0);
        const earningsAfter = currentEarnings + commission;
        await transaction.order.update({
            where: {
                id: order.id,
            },
            data: {
                reviewerCommission: new Prisma.Decimal(commission),
            },
        });
        await transaction.affiliateLink.update({
            where: {
                id: order.affiliateLink.id,
            },
            data: {
                successfulOrders: {
                    increment: 1,
                },
                totalEarnings: {
                    increment: new Prisma.Decimal(commission),
                },
            },
        });
        const successfulOrderAggregate = await transaction.affiliateLink.aggregate({
            where: { reviewerId: order.affiliateLink.reviewerId },
            _sum: { successfulOrders: true },
        });
        const rank = calculateReviewerRank(Number(successfulOrderAggregate._sum.successfulOrders ?? 0));
        const reviewer = await transaction.customer.update({
            where: { id: order.affiliateLink.reviewerId },
            data: {
                reviewerPoints: { increment: 100 },
                reviewerRank: rank,
            },
            select: { reviewerPoints: true },
        });
        await transaction.reviewerPointTransaction.create({
            data: {
                reviewerId: order.affiliateLink.reviewerId,
                amount: 100,
                pointsAfter: reviewer.reviewerPoints,
                type: "SuccessfulOrder",
                reason: `Affiliate Order ${order.id} hoàn thành`,
                referenceId: order.id,
            },
        });
        return transaction.reviewerEarningTransaction.create({
            data: {
                reviewerId: order.affiliateLink.reviewerId,
                orderId: order.id,
                amount: new Prisma.Decimal(commission),
                earningsAfter: new Prisma.Decimal(earningsAfter),
                type: "Commission",
                reason: `Hoa hồng ${REVIEWER_COMMISSION_PERCENT}% từ Order ${order.id}`,
            },
        });
    });
    await createNotification({
        userId: order.affiliateLink.reviewer.userId,
        type: NotificationType.Affiliate,
        title: "Bạn vừa nhận được hoa hồng",
        message: `Bạn đã nhận được ${commission.toLocaleString("vi-VN")} VNĐ hoa hồng từ một đơn hàng thành công.`,
        referenceId: earningTransaction.id,
        referenceType: "ReviewerEarningTransaction",
    });
    return earningTransaction;
};
