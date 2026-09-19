import QRCode from "qrcode";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

import {
  CheckInStatus,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  MerchantStatus,
} from "../../generated/prisma/client.js";
import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

import { AppError } from "../../common/errors/app-error.js";
import { createNotification } from "../notifications/notification.service.js";
import { awardGemPoints } from "../gem-points/gem-point.service.js";

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const earthRadius = 6371000; // Earth radius in meters

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

/**
 * @deprecated Legacy Order-based QR lookup. DirectQr and CustomerCode do not
 * call this helper and are the primary UFind CheckIn flows.
 */
const getOrderForCheckIn = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },

    select: {
      id: true,
      customerId: true,
      merchantId: true,

      orderType: true,
      campaignId: true,
      affiliateLinkId: true,
      status: true,
      paymentStatus: true,

      merchant: {
        select: {
          id: true,
          userId: true,
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

const hashQrToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const hashDirectQrUsage = (token: string, customerId: string) =>
  createHash("sha256")
    .update(`${token}:${customerId}`)
    .digest("hex");

const MAX_HOURLY_CHECK_INS = 5;
const MAX_TRANSACTION_RETRIES = 3;

const runSerializableTransaction = async <T>(
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: any) {
      if (error?.code === "P2034" && attempt < MAX_TRANSACTION_RETRIES) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Transaction retry exhausted");
};

const createAcquisitionEvent = async (
  transaction: Prisma.TransactionClient,
  checkIn: {
    id: string;
    customerId: string;
    merchantId: string;
    campaignId: string | null;
    orderId: string | null;
    bookingId: string | null;
    affiliateLinkId: string | null;
    source: string | null;
    checkInMethod: "OrderQr" | "DirectQr" | "CustomerCode";
    checkedInAt: Date | null;
  },
) => {
  if (!checkIn.checkedInAt) {
    throw new AppError(409, "Check-in chưa có thời điểm xác nhận");
  }

  return transaction.merchantAcquisitionEvent.create({
    data: {
      merchantId: checkIn.merchantId,
      customerId: checkIn.customerId,
      checkInId: checkIn.id,
      campaignId: checkIn.campaignId,
      orderId: checkIn.orderId,
      bookingId: checkIn.bookingId,
      affiliateLinkId: checkIn.affiliateLinkId,
      source: checkIn.source,
      verificationMethod: checkIn.checkInMethod,
      occurredAt: checkIn.checkedInAt,
    },
  });
};

const getEligibleVisitCampaign = async (
  campaignId: string,
  merchantId: string,
) => {
  const now = new Date();
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      merchantId,
      isActive: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    select: {
      id: true,
      merchantId: true,
      verifiedVisitLimit: true,
      maxVerifiedVisitsPerCustomer: true,
    },
  });

  if (!campaign) {
    throw new AppError(409, "Campaign không còn hoạt động");
  }

  return campaign;
};

const assertCampaignVisitCapacity = async (
  campaignId: string,
  verifiedVisitLimit: number | null,
) => {
  if (verifiedVisitLimit === null) return;

  const verifiedVisits = await prisma.merchantAcquisitionEvent.count({
    where: { campaignId, status: "Valid" },
  });

  if (verifiedVisits >= verifiedVisitLimit) {
    throw new AppError(409, "Campaign đã đạt giới hạn Verified Visit");
  }
};

const resolveCampaignAttribution = async (
  campaignId: string | null | undefined,
  merchantId: string,
  customerId: string,
) => {
  if (!campaignId) return null;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      merchantId,
      isActive: true,
      startAt: { lte: new Date() },
      endAt: { gte: new Date() },
    },
    select: {
      id: true,
      verifiedVisitLimit: true,
      maxVerifiedVisitsPerCustomer: true,
    },
  });

  if (!campaign) return null;

  if (campaign.verifiedVisitLimit !== null) {
    const total = await prisma.merchantAcquisitionEvent.count({
      where: { campaignId: campaign.id, status: "Valid" },
    });

    if (total >= campaign.verifiedVisitLimit) return null;
  }

  const customerTotal = await prisma.merchantAcquisitionEvent.count({
    where: {
      campaignId: campaign.id,
      customerId,
      status: "Valid",
    },
  });

  if (customerTotal >= campaign.maxVerifiedVisitsPerCustomer) return null;

  return campaign;
};

const resolveCampaignAttributionInTransaction = async (
  transaction: Prisma.TransactionClient,
  campaignId: string | null | undefined,
  merchantId: string,
  customerId: string,
) => {
  if (!campaignId) return null;

  const now = new Date();
  const campaign = await transaction.campaign.findFirst({
    where: {
      id: campaignId,
      merchantId,
      isActive: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    select: {
      id: true,
      verifiedVisitLimit: true,
      maxVerifiedVisitsPerCustomer: true,
    },
  });

  if (!campaign) return null;

  if (campaign.verifiedVisitLimit !== null) {
    const total = await transaction.merchantAcquisitionEvent.count({
      where: {
        campaignId: campaign.id,
        status: "Valid",
      },
    });

    if (total >= campaign.verifiedVisitLimit) return null;
  }

  const customerTotal = await transaction.merchantAcquisitionEvent.count({
    where: {
      campaignId: campaign.id,
      customerId,
      status: "Valid",
    },
  });

  if (customerTotal >= campaign.maxVerifiedVisitsPerCustomer) return null;

  return campaign;
};

export const generateCheckInQr = async (
  merchantId: string,
  orderId?: string,
  campaignId?: string,
): Promise<Buffer> => {
  if (!orderId) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        status: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!merchant || merchant.status !== MerchantStatus.Active) {
      throw new AppError(404, "Quan khong ton tai hoac chua hoat dong");
    }

    if (merchant.latitude === null || merchant.longitude === null) {
      throw new AppError(409, "Quan chua thiet lap vi tri check-in");
    }

    if (campaignId) {
      const campaign = await getEligibleVisitCampaign(campaignId, merchantId);
      await assertCampaignVisitCapacity(campaign.id, campaign.verifiedVisitLimit);
    }

    const token = jwt.sign(
      {
        type: "DirectVisit",
        merchantId,
        campaignId: campaignId ?? null,
      },
      env.JWT_ACCESS_SECRET,
      {
        expiresIn: "15m",
        jwtid: randomBytes(16).toString("hex"),
      },
    );

    const checkInUrl =
      `${env.FRONTEND_URL.replace(/\/$/, "")}` +
      `/check-in?checkInToken=${encodeURIComponent(token)}`;

    return QRCode.toBuffer(checkInUrl, {
      type: "png",
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
    });
  }
  /**
   * Legacy OrderQr branch. Kept for backward compatibility; new UFind flows
   * should omit orderId and use DirectQr or CustomerCode verification.
   */
  const order = await getOrderForCheckIn(orderId);

  if (order.merchantId !== merchantId) {
    throw new AppError(403, "Order không thuộc Merchant này");
  }

  if (order.orderType !== OrderType.Offline) {
    throw new AppError(400, "Chỉ order Offline mới sử dụng QR check-in");
  }

  if (
    order.status !== OrderStatus.Accepted &&
    order.status !== OrderStatus.Ready &&
    order.status !== OrderStatus.Completed
  ) {
    throw new AppError(409, "Order chưa ở trạng thái có thể tạo QR check-in");
  }

  if (order.paymentStatus === OrderPaymentStatus.Rejected) {
    throw new AppError(
      409,
      "Hóa đơn đã bị từ chối, Merchant phải cập nhật lại trước",
    );
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
      campaignId: order.campaignId,
      affiliateLinkId: order.affiliateLinkId,
      source: order.affiliateLinkId
        ? "Affiliate"
        : order.campaignId
          ? "Campaign"
          : "OrderQr",
      checkInMethod: "OrderQr",
      qrToken: hashQrToken(qrToken),
      generatedAt,
      expiresAt,
    },
    update: {
      qrToken: hashQrToken(qrToken),
      generatedAt,
      expiresAt,
      campaignId: order.campaignId,
      affiliateLinkId: order.affiliateLinkId,
      source: order.affiliateLinkId
        ? "Affiliate"
        : order.campaignId
          ? "Campaign"
          : "OrderQr",
      checkInMethod: "OrderQr",
    },
  });

  const checkInUrl =
    `${env.FRONTEND_URL.replace(/\/$/, "")}` +
    `/check-in?orderId=${encodeURIComponent(order.id)}` +
    `&checkInToken=${encodeURIComponent(qrToken)}`;

  return QRCode.toBuffer(checkInUrl, {
    type: "png",
    width: 420,
    margin: 2,
    errorCorrectionLevel: "M",
  });
};

const verifyDirectCheckIn = async (
  customerId: string,
  token: string,
  latitude: number,
  longitude: number,
) => {
  let payload: {
    type?: string;
    merchantId?: string;
    campaignId?: string | null;
  };

  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as typeof payload;
  } catch {
    throw new AppError(
      400,
      "Ma QR check-in khong hop le hoac da het hieu luc",
    );
  }

  if (payload.type !== "DirectVisit" || !payload.merchantId) {
    throw new AppError(400, "Ma QR check-in khong hop le");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!customer) {
    throw new AppError(404, "Khong tim thay Customer");
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: payload.merchantId },
    select: {
      id: true,
      userId: true,
      name: true,
      logoUrl: true,
      latitude: true,
      longitude: true,
      status: true,
    },
  });

  if (!merchant || merchant.status !== MerchantStatus.Active) {
    throw new AppError(404, "Quan khong ton tai hoac chua hoat dong");
  }

  if (customer.userId === merchant.userId) {
    throw new AppError(403, "Merchant khong the tu check-in cho chinh minh");
  }

  if (merchant.latitude === null || merchant.longitude === null) {
    throw new AppError(409, "Quan chua thiet lap vi tri check-in");
  }

  const merchantLatitude = Number(merchant.latitude);
  const merchantLongitude = Number(merchant.longitude);

  if (
    !Number.isFinite(merchantLatitude) ||
    !Number.isFinite(merchantLongitude)
  ) {
    throw new AppError(409, "Toa do quan khong hop le");
  }

  const distanceMeters = calculateDistanceMeters(
    latitude,
    longitude,
    merchantLatitude,
    merchantLongitude,
  );
  const MAX_CHECK_IN_DISTANCE_METERS = 100;

  if (distanceMeters > MAX_CHECK_IN_DISTANCE_METERS) {
    await prisma.auditLog
      .create({
        data: {
          actorUserId: customer.userId,
          action: "CHECKIN_GEOFENCE_FAILED",
          entityType: "CheckIn",
          entityId: merchant.id,
          metadata: {
            merchantId: merchant.id,
            customerLatitude: latitude,
            customerLongitude: longitude,
            merchantLatitude,
            merchantLongitude,
            distanceMeters,
            maxAllowedMeters: MAX_CHECK_IN_DISTANCE_METERS,
            source: "DirectVisit",
          },
        },
      })
      .catch(() => null);

    throw new AppError(
      400,
      `Ban dang o qua xa quan (${Math.round(distanceMeters)}m).`,
    );
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCheckIns = await prisma.checkIn.count({
    where: {
      customerId,
      checkedInAt: { gte: oneHourAgo },
      status: CheckInStatus.Verified,
    },
  });

  if (hourlyCheckIns >= MAX_HOURLY_CHECK_INS) {
    await prisma.auditLog
      .create({
        data: {
          actorUserId: customer.userId,
          action: "CHECKIN_REJECTED",
          entityType: "CheckIn",
          entityId: merchant.id,
          metadata: {
            merchantId: merchant.id,
            reason: "Abnormal check-in velocity",
            suspicious: true,
            source: "DirectVisit",
          },
        },
      })
      .catch(() => null);

    throw new AppError(
      429,
      "Tan suat check-in bat thuong, vui long thu lai sau",
    );
  }

  const tokenHash = hashDirectQrUsage(token, customerId);
  const existingCheckIn = await prisma.checkIn.findUnique({
    where: { qrToken: tokenHash },
    select: { id: true },
  });

  if (existingCheckIn) {
    throw new AppError(409, "Ma QR nay da duoc su dung");
  }

  const checkedInAt = new Date();
  let verificationResult;

  try {
    verificationResult = await runSerializableTransaction(async (transaction) => {
      const attributedCampaign =
        await resolveCampaignAttributionInTransaction(
          transaction,
          payload.campaignId,
          merchant.id,
          customerId,
        );
      const attributionCampaignId = attributedCampaign?.id ?? null;
      const source = attributionCampaignId ? "Campaign" : "DirectVisit";

      const created = await transaction.checkIn.create({
        data: {
          orderId: null,
          customerId,
          merchantId: merchant.id,
          qrToken: tokenHash,
          campaignId: attributionCampaignId,
          affiliateLinkId: null,
          source,
          checkInMethod: "DirectQr",
          status: CheckInStatus.Verified,
          generatedAt: checkedInAt,
          checkedInAt,
          verifiedAt: checkedInAt,
          latitude,
          longitude,
        },
      });

      await createAcquisitionEvent(transaction, {
        id: created.id,
        customerId,
        merchantId: merchant.id,
        campaignId: attributionCampaignId,
        orderId: null,
        bookingId: null,
        affiliateLinkId: null,
        source,
        checkInMethod: "DirectQr",
        checkedInAt,
      });

      const reward = await awardGemPoints(transaction, {
        customerId,
        action: "VERIFIED_VISIT",
        referenceId: created.id,
        reason: `Verified Visit tại ${merchant.name}`,
      });

      return {
        checkIn: created,
        reward,
        campaignId: attributionCampaignId,
      };
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new AppError(409, "Ma QR nay da duoc su dung");
    }
    throw error;
  }

  const { checkIn, reward, campaignId } = verificationResult;

  await createNotification({
    userId: customer.userId,
    type: NotificationType.System,
    title: "Check-in thanh cong",
    message: reward.awarded
      ? `Bạn đã xác minh lượt ghé tại ${merchant.name} (+${reward.amount} Gem Points).`
      : `Bạn đã xác minh lượt ghé tại ${merchant.name}.`,
    referenceId: checkIn.id,
    referenceType: "CheckIn",
  }).catch(() => null);

  return {
    checkInId: checkIn.id,
    orderId: null,
    merchant,
    campaignId,
    checkedInAt,
    distanceMeters: Math.round(distanceMeters),
    pointsAwarded: reward.amount,
    gemPointsAwarded: reward.amount,
    status: CheckInStatus.Verified,
  };
};

export const verifyCheckIn = async (
  customerId: string,
  orderId: string | undefined,
  checkInToken: string,
  latitude: number,
  longitude: number,
) => {
  if (!orderId) return verifyDirectCheckIn(customerId, checkInToken, latitude, longitude);
  const order = await getOrderForCheckIn(orderId);

  if (order.customerId !== customerId) {
    throw new AppError(403, "Order không thuộc Customer này");
  }

  if (order.customer.userId === order.merchant.userId) {
    throw new AppError(403, "Merchant không thể tự check-in cho chính mình");
  }

  if (order.orderType !== OrderType.Offline) {
    throw new AppError(400, "Order này không phải order Offline");
  }

  if (
    order.status !== OrderStatus.Accepted &&
    order.status !== OrderStatus.Ready &&
    order.status !== OrderStatus.Completed
  ) {
    throw new AppError(409, "Order chưa ở trạng thái có thể check-in");
  }

  const merchantLatitude = Number(order.merchant.latitude);
  const merchantLongitude = Number(order.merchant.longitude);

  if (
    !Number.isFinite(merchantLatitude) ||
    !Number.isFinite(merchantLongitude)
  ) {
    throw new AppError(409, "Quán chưa thiết lập vị trí check-in");
  }

  const distanceMeters = calculateDistanceMeters(
    latitude,
    longitude,
    merchantLatitude,
    merchantLongitude,
  );

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

    throw new AppError(
      400,
      `Bạn đang ở quá xa quán (${Math.round(distanceMeters)}m). Vui lòng check-in trực tiếp tại quán (bán kính tối đa ${MAX_CHECK_IN_DISTANCE_METERS}m)`,
    );
  }

  const hourlyCheckIns = await prisma.checkIn.count({
    where: {
      customerId,
      checkedInAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      status: CheckInStatus.Verified,
    },
  });

  if (hourlyCheckIns >= MAX_HOURLY_CHECK_INS) {
    await prisma.checkIn.updateMany({
      where: { orderId: order.id },
      data: {
        status: CheckInStatus.Rejected,
        suspicious: true,
        suspiciousReason: "Abnormal check-in velocity",
      },
    });
    throw new AppError(
      429,
      "Tần suất check-in bất thường, vui lòng thử lại sau",
    );
  }

  const checkedInAt = new Date();
  const verification = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.checkIn.updateMany({
      where: {
        orderId: order.id,
        customerId,
        qrToken: hashQrToken(checkInToken),
        checkedInAt: null,
        expiresAt: { gt: checkedInAt },
      },
      data: {
        checkedInAt,
        verifiedAt: checkedInAt,
        latitude,
        longitude,
        checkInMethod: "OrderQr",
        source: "OrderQr",
        status: CheckInStatus.Verified,
      },
    });

    if (updated.count === 0) {
      return { updated, checkIn: null };
    }

    const checkIn = await transaction.checkIn.findUniqueOrThrow({
      where: { orderId: order.id },
      select: {
        id: true,
        customerId: true,
        merchantId: true,
        campaignId: true,
        orderId: true,
        bookingId: true,
        affiliateLinkId: true,
        source: true,
        checkInMethod: true,
        checkedInAt: true,
      },
    });

    await createAcquisitionEvent(transaction, checkIn);

    const reward = await awardGemPoints(transaction, {
      customerId,
      action: "VERIFIED_VISIT",
      referenceId: checkIn.id,
      reason: `Verified Visit tại ${order.merchant.name}`,
    });

    return { updated, checkIn, reward };
  });

  const updated = verification.updated;

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

  if (!verification.checkIn || !verification.reward) {
    throw new AppError(500, "Không tạo được reward cho Verified Visit");
  }

  await createNotification({
    userId: order.customer.userId,
    type: NotificationType.System,
    title: "Check-in thành công",
    message: verification.reward.awarded
      ? `Bạn đã check-in thành công tại ${order.merchant.name} (+${verification.reward.amount} Gem Points).`
      : `Bạn đã check-in thành công tại ${order.merchant.name}.`,
    referenceId: verification.checkIn.id,
    referenceType: "CheckIn",
  });

  return {
    orderId: order.id,
    merchant: order.merchant,
    checkedInAt,
    distanceMeters: Math.round(distanceMeters),
    pointsAwarded: verification.reward.amount,
    gemPointsAwarded: verification.reward.amount,
    status: "Verified",
  };
};

export const getCurrentCheckIns = async (customerId: string) => {
  await prisma.checkIn.updateMany({
    where: {
      customerId,
      status: CheckInStatus.Pending,
      expiresAt: { lte: new Date() },
    },
    data: { status: CheckInStatus.Expired },
  });
  const checkIns = await prisma.checkIn.findMany({
    where: {
      customerId,
    },
    select: {
      id: true,
      orderId: true,
      checkedInAt: true,
      verifiedAt: true,
      generatedAt: true,
      disputedAt: true,
      suspicious: true,
      suspiciousReason: true,
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
      generatedAt: "desc",
    },
    take: 50,
  });

  return checkIns.map((checkIn) => ({
    id: checkIn.id,
    orderId: checkIn.orderId,
    merchant: checkIn.merchant,
    amount: checkIn.order ? Number(checkIn.order.finalPrice) : 0,
    checkedInAt: checkIn.checkedInAt,
    verifiedAt: checkIn.verifiedAt,
    disputedAt: checkIn.disputedAt,
    suspicious: checkIn.suspicious,
    suspiciousReason: checkIn.suspiciousReason,
    status: checkIn.status,
  }));
};

export const disputeCheckIn = async (
  customerId: string,
  checkInId: string,
  reason?: string,
) => {
  const checkIn = await prisma.checkIn.findFirst({
    where: { id: checkInId, customerId, status: CheckInStatus.Verified },
    select: {
      id: true,
      merchantId: true,
      status: true,
      customer: { select: { userId: true } },
      acquisitionEvent: { select: { id: true, status: true } },
    },
  });
  if (!checkIn)
    throw new AppError(404, "Không tìm thấy Verified Check-in có thể dispute");
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.checkIn.update({
      where: { id: checkInId },
      data: {
        status: CheckInStatus.Disputed,
        disputedAt: new Date(),
        suspiciousReason: reason?.trim() || "Customer disputed verification",
      },
    });
    if (checkIn.acquisitionEvent) {
      await transaction.merchantAcquisitionEvent.update({
        where: { id: checkIn.acquisitionEvent.id },
        data: { status: "Disputed" },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorUserId: checkIn.customer.userId,
        action: "MERCHANT_ACQUISITION_DISPUTED",
        entityType: "MerchantAcquisitionEvent",
        entityId: checkInId,
        metadata: {
          merchantId: checkIn.merchantId,
          reason: reason?.trim() || null,
          oldStatus: checkIn.acquisitionEvent?.status ?? null,
          newStatus: checkIn.acquisitionEvent ? "Disputed" : null,
          checkInOldStatus: checkIn.status,
          checkInNewStatus: updated.status,
        },
      },
    });
    return updated;
  });
  return result;
};

export const getMerchantCheckInStatistics = async (merchantId: string) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [total, verified, today, verifiedCheckIns, merchantOrders] =
    await prisma.$transaction([
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

  const dateMap = new Map<
    string,
    { totalCheckIns: number; customerSet: Set<string> }
  >();

  for (const c of verifiedCheckIns) {
    if (!c.checkedInAt) continue;
    const dateStr = c.checkedInAt.toISOString().split("T")[0];
    if (!dateStr) continue;
    const current = dateMap.get(dateStr) || {
      totalCheckIns: 0,
      customerSet: new Set<string>(),
    };
    current.totalCheckIns += 1;
    if (c.customerId) current.customerSet.add(c.customerId);
    dateMap.set(dateStr, current);
  }

  const customersOverTime = Array.from(dateMap.entries()).map(
    ([date, val]) => ({
      date,
      totalCheckIns: val.totalCheckIns,
      uniqueCustomers: val.customerSet.size,
    }),
  );

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

export const getMerchantCheckInHistory = async (merchantId: string) => {
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
      rewardBenefit: true,
      notes: true,
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
    amount: item.order ? Number(item.order.finalPrice) : 0,
    orderType: item.order ? item.order.orderType : "DirectCheckIn",
    rewardBenefit: item.rewardBenefit,
    notes: item.notes,
    generatedAt: item.generatedAt,
    checkedInAt: item.checkedInAt,
    verifiedAt: item.verifiedAt,
    status: item.status,
    latitude: item.latitude ? Number(item.latitude) : null,
    longitude: item.longitude ? Number(item.longitude) : null,
  }));
};

const generateUniqueCustomerCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "UGEM-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getCustomerCheckInCode = async (userId: string) => {
  const customer = await prisma.customer.findUnique({
    where: { userId },
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
  });

  if (!customer) {
    throw new AppError(404, "Không tìm thấy thông tin Customer");
  }

  let code = customer.customerCode;
  if (!code) {
    let attempts = 0;
    while (!code && attempts < 10) {
      attempts++;
      const candidate = generateUniqueCustomerCode();
      const exists = await prisma.customer.findUnique({
        where: { customerCode: candidate },
      });
      if (!exists) {
        code = candidate;
        await prisma.customer.update({
          where: { id: customer.id },
          data: { customerCode: code },
        });
      }
    }
  }

  const qrString = `UGEM:CHECKIN:${code}`;
  const qrDataUrl = await QRCode.toDataURL(qrString, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return {
    customerId: customer.id,
    customerCode: code,
    qrDataUrl,
    fullName: customer.user.fullName,
    phoneNumber: customer.user.phoneNumber,
    gemPoints: customer.gemPoints,
    contributionRank: customer.contributionRank,
    reviewerPoints: customer.reviewerPoints,
    reviewerRank: customer.reviewerRank,
    activeBenefits: [
      "Giảm 5% cho hóa đơn tiếp theo tại quán",
      "Tặng 1 ly Coca / Nước ngọt khi check-in",
      "Tích ngay +10 điểm thưởng Loyalty UGem",
    ],
  };
};

export const merchantVerifyCustomerCode = async (
  merchantId: string,
  customerCode: string,
  rewardBenefit?: string,
  notes?: string,
) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
    },
  });

  if (!merchant || merchant.status !== MerchantStatus.Active) {
    throw new AppError(404, "Quan khong ton tai hoac chua hoat dong");
  }

  const normalizedCode = customerCode.trim().toUpperCase();
  const customer = await prisma.customer.findUnique({
    where: { customerCode: normalizedCode },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!customer) {
    throw new AppError(
      404,
      `Khong tim thay khach hang voi ma "${customerCode}"`,
    );
  }

  if (customer.user.id === merchant.userId) {
    throw new AppError(403, "Merchant khong the tu check-in cho chinh minh");
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentCheckIn = await prisma.checkIn.findFirst({
    where: {
      merchantId,
      customerId: customer.id,
      status: CheckInStatus.Verified,
      checkedInAt: { gte: twoHoursAgo },
    },
    select: { id: true },
  });

  if (recentCheckIn) {
    throw new AppError(
      400,
      `Khach hang ${customer.user.fullName} da check-in tai quan trong vong 2 gio qua.`,
    );
  }

  const checkedInAt = new Date();
  const appliedBenefit = rewardBenefit?.trim() || null;

  const checkInRecord = await prisma.$transaction(async (transaction) => {
    const record = await transaction.checkIn.create({
      data: {
        orderId: null,
        customerId: customer.id,
        merchantId,
        rewardBenefit: appliedBenefit,
        notes: notes?.trim() || null,
        source: "CustomerCode",
        campaignId: null,
        affiliateLinkId: null,
        checkInMethod: "CustomerCode",
        status: CheckInStatus.Verified,
        generatedAt: checkedInAt,
        checkedInAt,
        verifiedAt: checkedInAt,
      },
    });

    await createAcquisitionEvent(transaction, {
      id: record.id,
      customerId: customer.id,
      merchantId,
      campaignId: null,
      orderId: null,
      bookingId: null,
      affiliateLinkId: null,
      source: "CustomerCode",
      checkInMethod: "CustomerCode",
      checkedInAt,
    });

    const reward = await awardGemPoints(transaction, {
      customerId: customer.id,
      action: "VERIFIED_VISIT",
      referenceId: record.id,
      reason: `Verified Visit tại ${merchant.name}`,
    });

    return { record, reward };
  });

  await createNotification({
    userId: customer.userId,
    type: NotificationType.System,
    title: "Check-in thanh cong tai quan!",
    message: checkInRecord.reward.awarded
      ? `Bạn đã xác minh lượt ghé tại ${merchant.name} (+${checkInRecord.reward.amount} Gem Points).`
      : `Bạn đã xác minh lượt ghé tại ${merchant.name}.`,
    referenceId: checkInRecord.record.id,
    referenceType: "CheckIn",
  }).catch(() => null);

  return {
    checkInId: checkInRecord.record.id,
    orderId: null,
    orderAmount: null,
    customerName: customer.user.fullName,
    customerPhone: customer.user.phoneNumber,
    customerCode: normalizedCode,
    rewardBenefit: appliedBenefit,
    checkedInAt,
    pointsAwarded: checkInRecord.reward.amount,
    gemPointsAwarded: checkInRecord.reward.amount,
    status: CheckInStatus.Verified,
  };
};
