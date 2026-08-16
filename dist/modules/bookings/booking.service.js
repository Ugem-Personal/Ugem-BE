import { AffiliateTransactionStatus, BookingStatus, MerchantStatus, NotificationType, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createNotification } from "../notifications/notification.service.js";
import { createReviewerBookingCommission } from "../affiliate-links/affiliate-earning.service.js";
export const createBooking = async (customerId, input) => {
    const merchant = await prisma.merchant.findUnique({
        where: { id: input.merchantId },
        select: { id: true, userId: true, name: true, status: true },
    });
    if (!merchant || merchant.status !== MerchantStatus.Active) {
        throw new AppError(404, "Merchant không tồn tại hoặc không hoạt động");
    }
    const bookingAt = new Date(input.bookingAt);
    if (isNaN(bookingAt.getTime()) || bookingAt <= new Date()) {
        throw new AppError(400, "Thời gian đặt bàn phải ở tương lai");
    }
    let affiliateLink = null;
    if (input.affiliateLinkCode?.trim()) {
        affiliateLink = await prisma.affiliateLink.findUnique({
            where: {
                linkCode: input.affiliateLinkCode.trim().toUpperCase(),
            },
            select: {
                id: true,
                reviewerId: true,
                merchantId: true,
                isActive: true,
            },
        });
        if (!affiliateLink || !affiliateLink.isActive) {
            throw new AppError(400, "Affiliate Link không hợp lệ");
        }
        if (affiliateLink.merchantId !== input.merchantId) {
            throw new AppError(400, "Affiliate Link không thuộc Merchant đặt bàn");
        }
        if (affiliateLink.reviewerId === customerId) {
            throw new AppError(400, "Reviewer không được dùng link của chính mình");
        }
    }
    const booking = await prisma.booking.create({
        data: {
            customerId,
            merchantId: input.merchantId,
            affiliateLinkId: affiliateLink?.id ?? null,
            bookingAt,
            partySize: input.partySize,
            note: input.note,
            status: BookingStatus.Pending,
        },
        include: {
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    address: true,
                    phone: true,
                },
            },
            customer: {
                include: {
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                },
            },
        },
    });
    if (affiliateLink) {
        await prisma.affiliateTransaction.create({
            data: {
                affiliateLinkId: affiliateLink.id,
                bookingId: booking.id,
                status: AffiliateTransactionStatus.Pending,
            },
        }).catch(() => null);
    }
    await createNotification({
        userId: merchant.userId,
        type: NotificationType.System,
        title: "Yêu cầu đặt bàn mới",
        message: `Khách hàng ${booking.customer.user.fullName} đã gửi yêu cầu đặt bàn (${input.partySize} người) lúc ${bookingAt.toLocaleString("vi-VN")}.`,
        referenceId: booking.id,
        referenceType: "Booking",
    });
    return booking;
};
export const getCustomerBookings = async (customerId) => {
    return prisma.booking.findMany({
        where: { customerId },
        include: {
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    address: true,
                    phone: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
};
export const getMerchantBookings = async (merchantId) => {
    return prisma.booking.findMany({
        where: { merchantId },
        include: {
            customer: {
                include: {
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                            avatarUrl: true,
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
};
export const reviewBooking = async (merchantId, bookingId, input) => {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            merchant: { select: { id: true, name: true } },
            customer: { select: { id: true, userId: true } },
        },
    });
    if (!booking) {
        throw new AppError(404, "Không tìm thấy thông tin đặt bàn");
    }
    if (booking.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền xử lý đặt bàn này");
    }
    if (booking.status !== BookingStatus.Pending) {
        throw new AppError(400, "Đặt bàn đã được xử lý trước đó");
    }
    if (input.status === "Rejected" && !input.rejectionReason?.trim()) {
        throw new AppError(400, "Vui lòng nhập lý do từ chối");
    }
    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: input.status === "Accepted" ? BookingStatus.Accepted : BookingStatus.Rejected,
            rejectionReason: input.status === "Rejected" ? input.rejectionReason : null,
        },
        include: {
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    address: true,
                    phone: true,
                },
            },
            customer: {
                include: {
                    user: {
                        select: {
                            fullName: true,
                            email: true,
                            phoneNumber: true,
                        },
                    },
                },
            },
        },
    });
    if (booking.affiliateLinkId) {
        if (input.status === "Accepted") {
            await prisma.affiliateTransaction.updateMany({
                where: {
                    bookingId: booking.id,
                    status: AffiliateTransactionStatus.Pending,
                },
                data: {
                    status: AffiliateTransactionStatus.Success,
                },
            }).catch(() => null);
            await createReviewerBookingCommission(booking.id).catch(() => null);
        }
        else if (input.status === "Rejected") {
            await prisma.affiliateTransaction.updateMany({
                where: {
                    bookingId: booking.id,
                    status: {
                        in: [
                            AffiliateTransactionStatus.Pending,
                            AffiliateTransactionStatus.Success,
                        ],
                    },
                },
                data: {
                    status: AffiliateTransactionStatus.Failed,
                },
            }).catch(() => null);
        }
    }
    const title = input.status === "Accepted" ? "Đặt bàn thành công!" : "Đặt bàn bị từ chối";
    const message = input.status === "Accepted"
        ? `Nhà hàng ${booking.merchant.name} đã xác nhận yêu cầu đặt bàn của bạn.`
        : `Nhà hàng ${booking.merchant.name} đã từ chối yêu cầu đặt bàn. Lý do: ${input.rejectionReason}`;
    await createNotification({
        userId: booking.customer.userId,
        type: NotificationType.System,
        title,
        message,
        referenceId: booking.id,
        referenceType: "Booking",
    });
    return updated;
};
export const cancelBooking = async (customerId, bookingId) => {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new AppError(404, "Không tìm thấy thông tin đặt bàn");
    }
    if (booking.customerId !== customerId) {
        throw new AppError(403, "Bạn không có quyền hủy đặt bàn này");
    }
    if (booking.status !== BookingStatus.Pending) {
        throw new AppError(400, "Chỉ có thể hủy khi đặt bàn đang chờ xác nhận");
    }
    if (booking.affiliateLinkId) {
        await prisma.affiliateTransaction.updateMany({
            where: {
                bookingId: booking.id,
                status: {
                    in: [
                        AffiliateTransactionStatus.Pending,
                        AffiliateTransactionStatus.Success,
                    ],
                },
            },
            data: {
                status: AffiliateTransactionStatus.Failed,
            },
        }).catch(() => null);
    }
    return prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: BookingStatus.Cancelled,
        },
    });
};
