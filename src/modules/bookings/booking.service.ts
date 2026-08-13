import {
  BookingStatus,
  MerchantStatus,
  NotificationType,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createNotification } from "../notifications/notification.service.js";

import type { CreateBookingInput, ReviewBookingInput } from "./booking.types.js";

export const createBooking = async (
  customerId: string,
  input: CreateBookingInput,
) => {
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

  const booking = await prisma.booking.create({
    data: {
      customerId,
      merchantId: input.merchantId,
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

export const getCustomerBookings = async (customerId: string) => {
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

export const getMerchantBookings = async (merchantId: string) => {
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

export const reviewBooking = async (
  merchantId: string,
  bookingId: string,
  input: ReviewBookingInput,
) => {
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

  const title = input.status === "Accepted" ? "Đặt bàn thành công!" : "Đặt bàn bị từ chối";
  const message =
    input.status === "Accepted"
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

export const cancelBooking = async (customerId: string, bookingId: string) => {
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

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.Cancelled,
    },
  });
};
