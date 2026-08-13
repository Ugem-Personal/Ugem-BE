import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as bookingService from "./booking.service.js";

const getCustomerId = (req: Request): string => {
  const customerId = req.user?.CustomerId;
  if (!customerId) {
    throw new AppError(403, "Tài khoản không có CustomerId");
  }
  return customerId;
};

const getMerchantId = (req: Request): string => {
  const merchantId = req.user?.MerchantId;
  if (!merchantId) {
    throw new AppError(403, "Hồ sơ Merchant chưa được duyệt");
  }
  return merchantId;
};

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingService.createBooking(
    getCustomerId(req),
    req.body,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Tạo yêu cầu đặt bàn thành công",
    data: booking,
  });
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await bookingService.getCustomerBookings(getCustomerId(req));

  return sendSuccess(res, {
    message: "Lấy danh sách đặt bàn thành công",
    data: bookings,
  });
});

export const getMerchantBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const bookings = await bookingService.getMerchantBookings(getMerchantId(req));

    return sendSuccess(res, {
      message: "Lấy danh sách đặt bàn Merchant thành công",
      data: bookings,
    });
  },
);

export const reviewBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const booking = await bookingService.reviewBooking(
    getMerchantId(req),
    id,
    req.body,
  );

  return sendSuccess(res, {
    message: "Xử lý đặt bàn thành công",
    data: booking,
  });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const booking = await bookingService.cancelBooking(getCustomerId(req), id);

  return sendSuccess(res, {
    message: "Hủy đặt bàn thành công",
    data: booking,
  });
});
