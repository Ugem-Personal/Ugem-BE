import QRCode from "qrcode";
import { createHash, randomBytes } from "node:crypto";
import { CheckInStatus, NotificationType, OrderPaymentStatus, OrderStatus, OrderType, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { createNotification } from "../notifications/notification.service.js";
const toRadians = (value) => (value * Math.PI) / 180;
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const earthRadius = 6371000; // Earth radius in meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
};
const getOrderForCheckIn = async (orderId) => {
    const order = await prisma.order.findUnique({
        where: {
            id: orderId,
        },
        select: {
            id: true,
            customerId: true,
            merchantId: true,
            orderType: true,
            status: true,
            paymentStatus: true,
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    latitude: true,
                    longitude: true,
                },
            },
            customer: {
                select: {
                    id: true,
                    userId: true,
                },
            },
            orderedAt: true,
            completedAt: true,
        },
    });
    if (!order) {
        throw new AppError(404, "Không tìm thấy order");
    }
    return order;
};
const hashQrToken = (token) => createHash("sha256").update(token).digest("hex");
export const generateCheckInQr = async (merchantId, orderId) => {
    const order = await getOrderForCheckIn(orderId);
    if (order.merchantId !== merchantId) {
        throw new AppError(403, "Order không thuộc Merchant này");
    }
    if (order.orderType !== OrderType.Offline) {
        throw new AppError(400, "Chỉ order Offline mới sử dụng QR check-in");
    }
    if (order.status !== OrderStatus.Accepted &&
        order.status !== OrderStatus.Ready &&
        order.status !== OrderStatus.Completed) {
        throw new AppError(409, "Order chưa ở trạng thái có thể tạo QR check-in");
    }
    if (order.paymentStatus === OrderPaymentStatus.Rejected) {
        throw new AppError(409, "Hóa đơn đã bị từ chối, Merchant phải cập nhật lại trước");
    }
    const existingCheckIn = await prisma.checkIn.findUnique({
        where: { orderId: order.id },
        select: { checkedInAt: true },
    });
    if (existingCheckIn?.checkedInAt) {
        throw new AppError(409, "Order này đã được check-in");
    }
    const qrToken = randomBytes(32).toString("base64url");
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 15 * 60 * 1000); // QR code active for 15 mins
    await prisma.checkIn.upsert({
        where: { orderId: order.id },
        create: {
            orderId: order.id,
            customerId: order.customerId,
            merchantId: order.merchantId,
            qrToken: hashQrToken(qrToken),
            generatedAt,
            expiresAt,
        },
        update: {
            qrToken: hashQrToken(qrToken),
            generatedAt,
            expiresAt,
        },
    });
    const checkInUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}` +
        `/check-in?orderId=${encodeURIComponent(order.id)}` +
        `&checkInToken=${encodeURIComponent(qrToken)}`;
    return QRCode.toBuffer(checkInUrl, {
        type: "png",
        width: 420,
        margin: 2,
        errorCorrectionLevel: "M",
    });
};
export const verifyCheckIn = async (customerId, orderId, checkInToken, latitude, longitude) => {
    const order = await getOrderForCheckIn(orderId);
    if (order.customerId !== customerId) {
        throw new AppError(403, "Order không thuộc Customer này");
    }
    if (order.orderType !== OrderType.Offline) {
        throw new AppError(400, "Order này không phải order Offline");
    }
    if (order.status !== OrderStatus.Accepted &&
        order.status !== OrderStatus.Ready &&
        order.status !== OrderStatus.Completed) {
        throw new AppError(409, "Order chưa ở trạng thái có thể check-in");
    }
    const merchantLatitude = Number(order.merchant.latitude);
    const merchantLongitude = Number(order.merchant.longitude);
    if (!Number.isFinite(merchantLatitude) ||
        !Number.isFinite(merchantLongitude)) {
        throw new AppError(409, "Quán chưa thiết lập vị trí check-in");
    }
    const distanceMeters = calculateDistanceMeters(latitude, longitude, merchantLatitude, merchantLongitude);
    const MAX_CHECK_IN_DISTANCE_METERS = 100;
    if (distanceMeters > MAX_CHECK_IN_DISTANCE_METERS) {
        // Update DB status to Rejected
        await prisma.checkIn
            .updateMany({
            where: { orderId: order.id },
            data: { status: CheckInStatus.Rejected },
        })
            .catch(() => null);
        // Log abnormal check-in attempt
        await prisma.auditLog
            .create({
            data: {
                actorUserId: order.customer.userId,
                action: "CHECKIN_GEOFENCE_FAILED",
                entityType: "CheckIn",
                entityId: order.id,
                metadata: {
                    merchantId: order.merchantId,
                    customerLatitude: latitude,
                    customerLongitude: longitude,
                    merchantLatitude,
                    merchantLongitude,
                    distanceMeters,
                    maxAllowedMeters: MAX_CHECK_IN_DISTANCE_METERS,
                    reason: "Ngoài phạm vi geofence",
                },
            },
        })
            .catch(() => null);
        throw new AppError(400, `Bạn đang ở quá xa quán (${Math.round(distanceMeters)}m). Vui lòng check-in trực tiếp tại quán (bán kính tối đa ${MAX_CHECK_IN_DISTANCE_METERS}m)`);
    }
    const checkedInAt = new Date();
    const updated = await prisma.checkIn.updateMany({
        where: {
            orderId: order.id,
            customerId,
            qrToken: hashQrToken(checkInToken),
            checkedInAt: null,
            expiresAt: {
                gt: checkedInAt,
            },
        },
        data: {
            checkedInAt,
            verifiedAt: checkedInAt,
            latitude,
            longitude,
            status: CheckInStatus.Verified,
        },
    });
    if (updated.count === 0) {
        const existing = await prisma.checkIn.findUnique({
            where: { orderId: order.id },
            select: { checkedInAt: true, expiresAt: true },
        });
        if (existing?.checkedInAt) {
            throw new AppError(409, "Mã QR này đã được sử dụng");
        }
        if (existing?.expiresAt && existing.expiresAt <= checkedInAt) {
            await prisma.checkIn
                .updateMany({
                where: { orderId: order.id },
                data: { status: CheckInStatus.Expired },
            })
                .catch(() => null);
            await prisma.auditLog
                .create({
                data: {
                    actorUserId: order.customer.userId,
                    action: "CHECKIN_EXPIRED",
                    entityType: "CheckIn",
                    entityId: order.id,
                    metadata: {
                        merchantId: order.merchantId,
                        reason: "Mã QR check-in đã hết hạn",
                    },
                },
            })
                .catch(() => null);
            throw new AppError(400, "Mã QR check-in đã hết hiệu lực");
        }
        await prisma.checkIn
            .updateMany({
            where: { orderId: order.id },
            data: { status: CheckInStatus.Rejected },
        })
            .catch(() => null);
        await prisma.auditLog
            .create({
            data: {
                actorUserId: order.customer.userId,
                action: "CHECKIN_REJECTED",
                entityType: "CheckIn",
                entityId: order.id,
                metadata: {
                    merchantId: order.merchantId,
                    reason: "Mã QR check-in không hợp lệ",
                },
            },
        })
            .catch(() => null);
        throw new AppError(400, "Mã QR check-in không hợp lệ hoặc đã hết hiệu lực");
    }
    // Award check-in reward points
    const CHECK_IN_REWARD_POINTS = 10;
    const currentCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { reviewerPoints: true },
    });
    const currentPoints = currentCustomer?.reviewerPoints ?? 0;
    const newPoints = currentPoints + CHECK_IN_REWARD_POINTS;
    await prisma
        .$transaction([
        prisma.customer.update({
            where: { id: customerId },
            data: { reviewerPoints: { increment: CHECK_IN_REWARD_POINTS } },
        }),
        prisma.reviewerPointTransaction.create({
            data: {
                reviewerId: customerId,
                amount: CHECK_IN_REWARD_POINTS,
                pointsAfter: newPoints,
                type: "CHECK_IN",
                reason: `Điểm thưởng check-in tại ${order.merchant.name}`,
                referenceId: order.id,
            },
        }),
    ])
        .catch(() => null);
    await createNotification({
        userId: order.customer.userId,
        type: NotificationType.System,
        title: "Check-in thành công",
        message: `Bạn đã check-in thành công tại ${order.merchant.name} (+${CHECK_IN_REWARD_POINTS} điểm thưởng).`,
        referenceId: order.id,
        referenceType: "CheckIn",
    });
    return {
        orderId: order.id,
        merchant: order.merchant,
        checkedInAt,
        distanceMeters: Math.round(distanceMeters),
        pointsAwarded: CHECK_IN_REWARD_POINTS,
        status: "Verified",
    };
};
export const getCurrentCheckIns = async (customerId) => {
    const checkIns = await prisma.checkIn.findMany({
        where: {
            customerId,
            checkedInAt: { not: null },
        },
        select: {
            id: true,
            orderId: true,
            checkedInAt: true,
            verifiedAt: true,
            status: true,
            merchant: {
                select: {
                    id: true,
                    name: true,
                    logoUrl: true,
                    address: true,
                },
            },
            order: {
                select: { finalPrice: true },
            },
        },
        orderBy: {
            checkedInAt: "desc",
        },
        take: 50,
    });
    return checkIns.map((checkIn) => ({
        id: checkIn.id,
        orderId: checkIn.orderId,
        merchant: checkIn.merchant,
        amount: Number(checkIn.order.finalPrice),
        checkedInAt: checkIn.checkedInAt,
        verifiedAt: checkIn.verifiedAt,
        status: checkIn.status,
    }));
};
export const getMerchantCheckInStatistics = async (merchantId) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [total, verified, today, verifiedCheckIns, merchantOrders] = await prisma.$transaction([
        prisma.checkIn.count({
            where: { merchantId },
        }),
        prisma.checkIn.count({
            where: {
                merchantId,
                status: CheckInStatus.Verified,
            },
        }),
        prisma.checkIn.count({
            where: {
                merchantId,
                status: CheckInStatus.Verified,
                checkedInAt: {
                    gte: startOfToday,
                },
            },
        }),
        prisma.checkIn.findMany({
            where: {
                merchantId,
                status: CheckInStatus.Verified,
                checkedInAt: { not: null },
            },
            select: {
                checkedInAt: true,
                customerId: true,
            },
            orderBy: {
                checkedInAt: "asc",
            },
        }),
        prisma.order.findMany({
            where: { merchantId },
            select: { id: true },
        }),
    ]);
    const dateMap = new Map();
    for (const c of verifiedCheckIns) {
        if (!c.checkedInAt)
            continue;
        const dateStr = c.checkedInAt.toISOString().split("T")[0];
        if (!dateStr)
            continue;
        const current = dateMap.get(dateStr) || {
            totalCheckIns: 0,
            customerSet: new Set(),
        };
        current.totalCheckIns += 1;
        if (c.customerId)
            current.customerSet.add(c.customerId);
        dateMap.set(dateStr, current);
    }
    const customersOverTime = Array.from(dateMap.entries()).map(([date, val]) => ({
        date,
        totalCheckIns: val.totalCheckIns,
        uniqueCustomers: val.customerSet.size,
    }));
    const merchantOrderIds = merchantOrders.map((o) => o.id);
    const abnormalLogs = await prisma.auditLog.findMany({
        where: {
            entityType: "CheckIn",
            action: {
                in: ["CHECKIN_GEOFENCE_FAILED", "CHECKIN_EXPIRED", "CHECKIN_REJECTED"],
            },
            OR: [
                { entityId: { in: merchantOrderIds } },
                { metadata: { path: ["merchantId"], equals: merchantId } },
            ],
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 50,
    });
    const abnormalCheckIns = abnormalLogs.map((log) => ({
        id: log.id,
        action: log.action,
        orderId: log.entityId,
        actorUserId: log.actorUserId,
        createdAt: log.createdAt,
        metadata: log.metadata,
    }));
    return {
        totalCheckIns: total,
        verifiedVisits: verified,
        todayCheckIns: today,
        customersOverTime,
        abnormalCheckIns,
    };
};
export const getMerchantCheckInHistory = async (merchantId) => {
    const checkIns = await prisma.checkIn.findMany({
        where: { merchantId },
        select: {
            id: true,
            orderId: true,
            generatedAt: true,
            checkedInAt: true,
            verifiedAt: true,
            latitude: true,
            longitude: true,
            status: true,
            customer: {
                select: {
                    id: true,
                    user: {
                        select: {
                            fullName: true,
                            phoneNumber: true,
                            avatarUrl: true,
                        },
                    },
                },
            },
            order: {
                select: {
                    finalPrice: true,
                    orderType: true,
                },
            },
        },
        orderBy: {
            generatedAt: "desc",
        },
        take: 100,
    });
    return checkIns.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        customerName: item.customer.user.fullName,
        customerPhone: item.customer.user.phoneNumber,
        customerAvatar: item.customer.user.avatarUrl,
        amount: Number(item.order.finalPrice),
        orderType: item.order.orderType,
        generatedAt: item.generatedAt,
        checkedInAt: item.checkedInAt,
        verifiedAt: item.verifiedAt,
        status: item.status,
        latitude: item.latitude ? Number(item.latitude) : null,
        longitude: item.longitude ? Number(item.longitude) : null,
    }));
};
