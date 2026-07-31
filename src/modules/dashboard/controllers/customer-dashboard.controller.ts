import type { Request, Response } from "express";

import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/utils/async-handler.js";
import { sendSuccess } from "../../../common/utils/api-response.js";

import {
  getCustomerDashboard as getCustomerDashboardService,
  getCustomerRecentOrders as getCustomerRecentOrdersService,
  getCustomerSpendingByYear as getCustomerSpendingByYearService,
  getCustomerOrderGrowthByYear as getCustomerOrderGrowthByYearService,
  getCustomerPaymentStatisticsByYear as getCustomerPaymentStatisticsByYearService,
  getCustomerFavoriteMerchantsByYear as getCustomerFavoriteMerchantsByYearService,
  getCustomerWeekdayStatisticsByYear as getCustomerWeekdayStatisticsByYearService,
  getCustomerPeakHoursByYear as getCustomerPeakHoursByYearService,
  getCustomerOrderPerformanceByYear as getCustomerOrderPerformanceByYearService,
  getCustomerDailySpending as getCustomerDailySpendingService,
} from "../services/customer-dashboard.service.js";

const getCustomerId = (req: Request): string => {
  const customerId = req.user?.CustomerId;

  if (!customerId) {
    throw new AppError(403, "Tài khoản không có CustomerId");
  }

  return customerId;
};

export const getCustomerDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboard = await getCustomerDashboardService(getCustomerId(req));

    return sendSuccess(res, {
      message: "Lấy Dashboard Customer thành công",
      data: dashboard,
    });
  },
);

export const getCustomerRecentOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getCustomerRecentOrdersService(
      getCustomerId(req),
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy đơn hàng gần đây của Customer thành công",
      data: result,
    });
  },
);

export const getCustomerSpendingByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerSpendingByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê chi tiêu theo tháng thành công",
      data: result,
    });
  },
);

export const getCustomerOrderGrowthByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerOrderGrowthByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê đơn hàng Customer theo tháng thành công",
      data: result,
    });
  },
);

export const getCustomerPaymentStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerPaymentStatisticsByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê phương thức thanh toán Customer thành công",
      data: result,
    });
  },
);

export const getCustomerFavoriteMerchantsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const limit = Number(req.query.limit ?? 5);

    const result = await getCustomerFavoriteMerchantsByYearService(
      getCustomerId(req),
      year,
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy danh sách Merchant yêu thích thành công",
      data: result,
    });
  },
);

export const getCustomerWeekdayStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerWeekdayStatisticsByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê ngày đặt món của Customer thành công",
      data: result,
    });
  },
);

export const getCustomerPeakHoursByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerPeakHoursByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê khung giờ đặt món của Customer thành công",
      data: result,
    });
  },
);

export const getCustomerOrderPerformanceByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getCustomerOrderPerformanceByYearService(
      getCustomerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê hiệu suất đơn hàng Customer thành công",
      data: result,
    });
  },
);

export const getCustomerDailySpending = asyncHandler(
  async (req: Request, res: Response) => {
    const startDate = String(req.query.startDate);

    const endDate = String(req.query.endDate);

    const result = await getCustomerDailySpendingService(
      getCustomerId(req),
      startDate,
      endDate,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê chi tiêu theo ngày của Customer thành công",
      data: result,
    });
  },
);
