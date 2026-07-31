import type { Request, Response } from "express";

import { asyncHandler } from "../../../common/utils/async-handler.js";
import { sendSuccess } from "../../../common/utils/api-response.js";

import {
  getStaffDashboard as getStaffDashboardService,
  getStaffRevenueByYear as getStaffRevenueByYearService,
  getStaffRecentOrders as getStaffRecentOrdersService,
  getStaffTopMerchants as getStaffTopMerchantsService,
  getStaffTopReviewers as getStaffTopReviewersService,
  getStaffTopFoods as getStaffTopFoodsService,
  getStaffUserGrowthByYear as getStaffUserGrowthByYearService,
  getStaffOrderGrowthByYear as getStaffOrderGrowthByYearService,
  getStaffReviewStatistics as getStaffReviewStatisticsService,
  getStaffPaymentStatisticsByYear as getStaffPaymentStatisticsByYearService,
  getStaffPeakHoursByYear as getStaffPeakHoursByYearService,
  getStaffWeekdayStatisticsByYear as getStaffWeekdayStatisticsByYearService,
  getStaffOrderPerformanceByYear as getStaffOrderPerformanceByYearService,
  getStaffDailyRevenue as getStaffDailyRevenueService,
} from "../services/staff-dashboard.service.js";

export const getStaffDashboard = asyncHandler(
  async (_req: Request, res: Response) => {
    const dashboard = await getStaffDashboardService();

    return sendSuccess(res, {
      message: "Lấy Dashboard Staff thành công",
      data: dashboard,
    });
  },
);

export const getStaffRevenueByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffRevenueByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê doanh thu theo tháng thành công",
      data: result,
    });
  },
);

export const getStaffRecentOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 10);

    const result = await getStaffRecentOrdersService(limit);

    return sendSuccess(res, {
      message: "Lấy đơn hàng gần đây của hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffTopMerchants = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getStaffTopMerchantsService(limit);

    return sendSuccess(res, {
      message: "Lấy danh sách Merchant có doanh thu cao nhất thành công",
      data: result,
    });
  },
);

export const getStaffTopReviewers = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getStaffTopReviewersService(limit);

    return sendSuccess(res, {
      message: "Lấy danh sách Reviewer có thu nhập cao nhất thành công",
      data: result,
    });
  },
);

export const getStaffTopFoods = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 10);

    const result = await getStaffTopFoodsService(limit);

    return sendSuccess(res, {
      message: "Lấy danh sách món ăn bán chạy toàn hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffUserGrowthByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffUserGrowthByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê tăng trưởng người dùng thành công",
      data: result,
    });
  },
);

export const getStaffOrderGrowthByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffOrderGrowthByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê tăng trưởng đơn hàng thành công",
      data: result,
    });
  },
);

export const getStaffReviewStatistics = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await getStaffReviewStatisticsService();

    return sendSuccess(res, {
      message: "Lấy thống kê Review toàn hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffPaymentStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffPaymentStatisticsByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê phương thức thanh toán thành công",
      data: result,
    });
  },
);

export const getStaffPeakHoursByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffPeakHoursByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê khung giờ đặt món toàn hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffWeekdayStatisticsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffWeekdayStatisticsByYearService(year);

    return sendSuccess(res, {
      message:
        "Lấy thống kê đơn hàng theo ngày trong tuần toàn hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffOrderPerformanceByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getStaffOrderPerformanceByYearService(year);

    return sendSuccess(res, {
      message: "Lấy thống kê hiệu suất đơn hàng toàn hệ thống thành công",
      data: result,
    });
  },
);

export const getStaffDailyRevenue = asyncHandler(
  async (req: Request, res: Response) => {
    const startDate = String(req.query.startDate);

    const endDate = String(req.query.endDate);

    const result = await getStaffDailyRevenueService(startDate, endDate);

    return sendSuccess(res, {
      message: "Lấy thống kê doanh thu theo ngày thành công",
      data: result,
    });
  },
);
