import QRCode from "qrcode";
import { createHash, randomBytes } from "node:crypto";

import {
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

import { AppError } from "../../common/errors/app-error.js";

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
      status: true,
      paymentStatus: true,

      merchant: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
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

export const generateCheckInQr = async (
  merchantId: string,
  orderId: string,
): Promise<Buffer> => {
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

  await prisma.checkIn.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      customerId: order.customerId,
      merchantId: order.merchantId,
      qrToken: hashQrToken(qrToken),
    },
    update: {
      qrToken: hashQrToken(qrToken),
      generatedAt: new Date(),
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

export const verifyCheckIn = async (
  customerId: string,
  orderId: string,
  checkInToken: string,
) => {
  const order = await getOrderForCheckIn(orderId);

  if (order.customerId !== customerId) {
    throw new AppError(403, "Order không thuộc Customer này");
  }

  if (order.orderType !== OrderType.Offline) {
    throw new AppError(400, "Order này không phải order Offline");
  }

  if (order.paymentStatus !== OrderPaymentStatus.Paid) {
    throw new AppError(409, "Order chưa được thanh toán");
  }

  if (
    order.status !== OrderStatus.Accepted &&
    order.status !== OrderStatus.Ready &&
    order.status !== OrderStatus.Completed
  ) {
    throw new AppError(409, "Order chưa ở trạng thái có thể check-in");
  }

  const checkedInAt = new Date();
  const updated = await prisma.checkIn.updateMany({
    where: {
      orderId: order.id,
      customerId,
      qrToken: hashQrToken(checkInToken),
      checkedInAt: null,
    },
    data: { checkedInAt },
  });

  if (updated.count === 0) {
    const existing = await prisma.checkIn.findUnique({
      where: { orderId: order.id },
      select: { checkedInAt: true },
    });

    if (existing?.checkedInAt) {
      throw new AppError(409, "Mã QR này đã được sử dụng");
    }

    throw new AppError(400, "Mã QR check-in không hợp lệ hoặc đã hết hiệu lực");
  }

  return {
    orderId: order.id,

    merchant: order.merchant,

    checkedInAt,

    status: "CheckedIn",
  };
};

export const getCurrentCheckIns = async (customerId: string) => {
  const checkIns = await prisma.checkIn.findMany({
    where: {
      customerId,
      checkedInAt: { not: null },
    },
    select: {
      id: true,
      orderId: true,
      checkedInAt: true,
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
  }));
};
