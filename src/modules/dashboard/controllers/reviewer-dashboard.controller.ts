import type { Request, Response } from "express";

import { AppError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/utils/async-handler.js";
import { sendSuccess } from "../../../common/utils/api-response.js";

import {
  getReviewerDashboard as getReviewerDashboardService,
  getReviewerRecentEarnings as getReviewerRecentEarningsService,
  getReviewerEarningsByYear as getReviewerEarningsByYearService,
  getReviewerAffiliateGrowthByYear as getReviewerAffiliateGrowthByYearService,
} from "../services/reviewer-dashboard.service.js";

const getReviewerId = (req: Request): string => {
  const reviewerId = req.user?.CustomerId;

  if (!reviewerId) {
    throw new AppError(403, "Tài khoản không có Reviewer ID");
  }

  if (req.user?.Role !== "Reviewer") {
    throw new AppError(403, "Chức năng chỉ dành cho Reviewer");
  }

  return reviewerId;
};

export const getReviewerDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboard = await getReviewerDashboardService(getReviewerId(req));

    return sendSuccess(res, {
      message: "Lấy Dashboard Reviewer thành công",
      data: dashboard,
    });
  },
);

export const getReviewerRecentEarnings = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 5);

    const result = await getReviewerRecentEarningsService(
      getReviewerId(req),
      limit,
    );

    return sendSuccess(res, {
      message: "Lấy giao dịch hoa hồng gần đây thành công",
      data: result,
    });
  },
);

export const getReviewerEarningsByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getReviewerEarningsByYearService(
      getReviewerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê hoa hồng theo tháng thành công",
      data: result,
    });
  },
);

export const getReviewerAffiliateGrowthByYear = asyncHandler(
  async (req: Request, res: Response) => {
    const year = Number(req.query.year ?? new Date().getFullYear());

    const result = await getReviewerAffiliateGrowthByYearService(
      getReviewerId(req),
      year,
    );

    return sendSuccess(res, {
      message: "Lấy thống kê Affiliate theo tháng thành công",
      data: result,
    });
  },
);
