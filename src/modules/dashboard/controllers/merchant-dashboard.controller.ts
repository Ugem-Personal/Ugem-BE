import type { Request, Response } from "express";

import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/utils/async-handler.js";
import { sendSuccess } from "../../../common/utils/api-response.js";

import {
  getMerchantDashboard as getMerchantDashboardService,
  getMerchantRevenueByYear as getMerchantRevenueByYearService,
  getMerchantTopFoods as getMerchantTopFoodsService,
  getMerchantRecentOrders as getMerchantRecentOrdersService,
  getMerchantOrderGrowthByYear as getMerchantOrderGrowthByYearService,
  getMerchantCampaignPerformance as getMerchantCampaignPerformanceService,
  getMerchantReviewStatistics as getMerchantReviewStatisticsService,
  getMerchantPaymentStatisticsByYear as getMerchantPaymentStatisticsByYearService,
  getMerchantCustomerStatisticsByYear as getMerchantCustomerStatisticsByYearService,
  getMerchantPeakHoursByYear as getMerchantPeakHoursByYearService,
  getMerchantWeekdayStatisticsByYear as getMerchantWeekdayStatisticsByYearService,
  getMerchantOrderPerformanceByYear as getMerchantOrderPerformanceByYearService,
  getMerchantDailyRevenue as getMerchantDailyRevenueService,
} from "../services/merchant-dashboard.service.js";

const getMerchantId = (req: Request): string => {
  const merchantId = req.user?.MerchantId;

  if (!merchantId) {
    throw new AppError(403, "Tài khoản không có MerchantId");
  }

  return merchantId;
};

export const getMerchantDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboard = await getMerchantDashboardService(getMerchantId(req));

    return sendSuccess(res, {
      message: "Lấy Dashboard Merchant thành công",
      data: dashboard,
    });
  },
);

export const getMerchantRevenueByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantRevenueByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy doanh thu Merchant theo tháng thành công",
      data: result,
    });
  },
);

export const getMerchantTopFoods = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getMerchantTopFoodsService(getMerchantId(req), limit);

    return sendSuccess(res, {
      message: "Lấy danh sách món bán chạy thành công",
      data: result,
    });
  },
);

export const getMerchantRecentOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getMerchantRecentOrdersService(
      getMerchantId(req),
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy đơn hàng gần đây thành công",
      data: result,
    });
  },
);

export const getMerchantOrderGrowthByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantOrderGrowthByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê đơn hàng Merchant theo tháng thành công",
      data: result,
    });
  },
);

export const getMerchantCampaignPerformance = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 10);

    const result = await getMerchantCampaignPerformanceService(
      getMerchantId(req),
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê hiệu quả Campaign thành công",
      data: result,
    });
  },
);

export const getMerchantReviewStatistics = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getMerchantReviewStatisticsService(getMerchantId(req));

    return sendSuccess(res, {
      message: "Lấy thống kê đánh giá Merchant thành công",
      data: result,
    });
  },
);

export const getMerchantPaymentStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantPaymentStatisticsByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê phương thức thanh toán Merchant thành công",
      data: result,
    });
  },
);

export const getMerchantCustomerStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const limit = Number(req.query.limit ?? 10);

    const result = await getMerchantCustomerStatisticsByYearService(
      getMerchantId(req),
      year,
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê khách hàng Merchant thành công",
      data: result,
    });
  },
);

export const getMerchantPeakHoursByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantPeakHoursByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê khung giờ đặt món thành công",
      data: result,
    });
  },
);

export const getMerchantWeekdayStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantWeekdayStatisticsByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê đơn hàng theo ngày trong tuần thành công",
      data: result,
    });
  },
);

export const getMerchantOrderPerformanceByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getMerchantOrderPerformanceByYearService(
      getMerchantId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê hiệu suất đơn hàng Merchant thành công",
      data: result,
    });
  },
);

export const getMerchantDailyRevenue = asyncHandler(
  async (req: Request, res: Response) => {
    const startDate = String(req.query.startDate);

    const endDate = String(req.query.endDate);

    const result = await getMerchantDailyRevenueService(
      getMerchantId(req),
      startDate,
      endDate,
    );

    return sendSuccess(res, {
      message: "Lấy doanh thu theo ngày của Merchant thành công",
      data: result,
    });
  },
);
