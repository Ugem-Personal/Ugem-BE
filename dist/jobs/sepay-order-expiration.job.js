import cron from "node-cron";
import { AffiliateTransactionStatus, BillStatus, NotificationType, OrderPaymentStatus, OrderStatus, PaymentMethod, } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { logger } from "../common/utils/logger.js";
import { createNotification } from "../modules/notifications/notification.service.js";
import { realtimeService } from "../modules/realtime/realtime.service.js";
export const DEFAULT_SEPAY_EXPIRATION_MINUTES = 15;
export const expireOverdueSepayOrders = async (options = {}) => {
    const thresholdMinutes = options.thresholdMinutes ?? DEFAULT_SEPAY_EXPIRATION_MINUTES;
    const now = options.now ?? new Date();
    const cutoffTime = new Date(now.getTime() - thresholdMinutes * 60 * 1000);
    try {
        // Find pending unpaid SePay / BankTransfer orders created before cutoff
        const overdueOrders = await prisma.order.findMany({
            where: {
                paymentMethod: {
                    in: [PaymentMethod.SePay, PaymentMethod.BankTransfer],
                },
                paymentStatus: {
                    in: [OrderPaymentStatus.Unpaid, OrderPaymentStatus.Pending],
                },
                status: OrderStatus.Pending,
                orderedAt: {
                    lte: cutoffTime,
                },
            },
            include: {
                customer: {
                    select: {
                        userId: true,
                    },
                },
                merchant: {
                    select: {
                        id: true,
                        userId: true,
                        name: true,
                    },
                },
                bill: true,
                details: {
                    include: {
                        toppings: true,
                        food: {
                            select: {
                                imageUrl: true,
                            },
                        },
                    },
                },
            },
        });
        if (overdueOrders.length === 0) {
            return { expiredCount: 0 };
        }
        logger.info("sepay_expiration.found_overdue_orders", {
            count: overdueOrders.length,
            cutoffTime: cutoffTime.toISOString(),
        });
        let expiredCount = 0;
        for (const order of overdueOrders) {
            try {
                const rejectionReason = `Tự động hủy do quá hạn thanh toán chuyển khoản (${thresholdMinutes} phút)`;
                await prisma.$transaction(async (transaction) => {
                    // 1. Update order status
                    await transaction.order.update({
                        where: { id: order.id },
                        data: {
                            status: OrderStatus.Cancelled,
                            paymentStatus: OrderPaymentStatus.Rejected,
                            rejectionReason,
                        },
                    });
                    // 2. Update bill if exists
                    if (order.bill) {
                        await transaction.bill.update({
                            where: { id: order.bill.id },
                            data: {
                                status: BillStatus.Rejected,
                                rejectionReason,
                                rejectedAt: now,
                            },
                        });
                    }
                    // 3. Revert Campaign usedCount if voucher was applied
                    if (order.campaignId) {
                        await transaction.campaign.updateMany({
                            where: {
                                id: order.campaignId,
                                usedCount: { gt: 0 },
                            },
                            data: {
                                usedCount: {
                                    decrement: 1,
                                },
                            },
                        });
                    }
                    // 4. Mark pending affiliate transactions as failed
                    if (order.affiliateLinkId) {
                        await transaction.affiliateTransaction.updateMany({
                            where: {
                                orderId: order.id,
                                status: AffiliateTransactionStatus.Pending,
                            },
                            data: {
                                status: AffiliateTransactionStatus.Failed,
                            },
                        });
                    }
                });
                // 5. Send notifications
                const shortCode = order.id.split("-")[0]?.toUpperCase() || order.id;
                if (order.customer?.userId) {
                    await createNotification({
                        userId: order.customer.userId,
                        type: NotificationType.Order,
                        title: "Đơn hàng đã bị hủy do quá hạn thanh toán",
                        message: `Đơn hàng #${shortCode} tại ${order.merchant?.name || "quán"} đã bị hủy do không hoàn tất thanh toán trong ${thresholdMinutes} phút.`,
                        referenceId: order.id,
                        referenceType: "Order",
                    }).catch(() => null);
                }
                if (order.merchant?.userId) {
                    await createNotification({
                        userId: order.merchant.userId,
                        type: NotificationType.Order,
                        title: "Đơn hàng bị hủy do quá hạn thanh toán",
                        message: `Đơn hàng #${shortCode} của khách ${order.name} đã tự động hủy do không nhận được thanh toán.`,
                        referenceId: order.id,
                        referenceType: "Order",
                    }).catch(() => null);
                }
                // 6. Emit Realtime SSE status_changed event
                const mappedPayload = {
                    orderId: order.id,
                    id: order.id,
                    name: order.name,
                    status: OrderStatus.Cancelled,
                    paymentStatus: OrderPaymentStatus.Rejected,
                    rejectionReason,
                };
                if (order.customer?.userId) {
                    realtimeService.sendToUser(order.customer.userId, "order:status_changed", mappedPayload);
                }
                realtimeService.sendToMerchant(order.merchantId, "order:status_changed", mappedPayload);
                expiredCount++;
            }
            catch (err) {
                logger.error("sepay_expiration.process_order_failed", {
                    orderId: order.id,
                    error: err,
                });
            }
        }
        logger.info("sepay_expiration.completed", { expiredCount });
        return { expiredCount };
    }
    catch (error) {
        logger.error("sepay_expiration.job_failed", { error });
        return { expiredCount: 0, error };
    }
};
export const startSepayOrderExpirationJob = () => {
    logger.info("[Sepay Expiration Job] Initialized (Running every 1 minute)");
    // Run immediately on server start to clean up any overdue orders during downtime
    void expireOverdueSepayOrders();
    // Schedule to run every 1 minute
    cron.schedule("*/1 * * * *", () => {
        void expireOverdueSepayOrders();
    });
};
