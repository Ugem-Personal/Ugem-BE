import { Router } from "express";

import { authenticate } from "../../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../../common/middleware/merchant.middleware.js";
import { validate } from "../../../common/middleware/validate.middleware.js";

import {
  getMerchantCampaignPerformance,
  getMerchantCustomerStatisticsByYear,
  getMerchantDailyRevenue,
  getMerchantDashboard,
  getMerchantOrderGrowthByYear,
  getMerchantOrderPerformanceByYear,
  getMerchantPaymentStatisticsByYear,
  getMerchantPeakHoursByYear,
  getMerchantRecentOrders,
  getMerchantRevenueByYear,
  getMerchantReviewStatistics,
  getMerchantTopFoods,
  getMerchantWeekdayStatisticsByYear,
} from "../controllers/merchant-dashboard.controller.js";

import {
  merchantCampaignPerformanceSchema,
  merchantCustomerStatisticsSchema,
  merchantDailyRevenueSchema,
  merchantOrderGrowthSchema,
  merchantOrderPerformanceSchema,
  merchantPaymentStatisticsSchema,
  merchantPeakHoursSchema,
  merchantRecentOrdersSchema,
  merchantRevenueSchema,
  merchantTopFoodsSchema,
  merchantWeekdayStatisticsSchema,
} from "../schemas/merchant-dashboard.schema.js";

export const merchantDashboardRouter = Router();

merchantDashboardRouter.use(authenticate, requireApprovedMerchant);

merchantDashboardRouter.get("/", getMerchantDashboard);

merchantDashboardRouter.get(
  "/revenue",
  validate(merchantRevenueSchema),
  getMerchantRevenueByYear,
);

merchantDashboardRouter.get(
  "/top-foods",
  validate(merchantTopFoodsSchema),
  getMerchantTopFoods,
);

merchantDashboardRouter.get(
  "/recent-orders",
  validate(merchantRecentOrdersSchema),
  getMerchantRecentOrders,
);

merchantDashboardRouter.get(
  "/order-growth",
  validate(merchantOrderGrowthSchema),
  getMerchantOrderGrowthByYear,
);

merchantDashboardRouter.get(
  "/campaign-performance",
  validate(merchantCampaignPerformanceSchema),
  getMerchantCampaignPerformance,
);

merchantDashboardRouter.get("/review-statistics", getMerchantReviewStatistics);

merchantDashboardRouter.get(
  "/payment-statistics",
  validate(merchantPaymentStatisticsSchema),
  getMerchantPaymentStatisticsByYear,
);

merchantDashboardRouter.get(
  "/customer-statistics",
  validate(merchantCustomerStatisticsSchema),
  getMerchantCustomerStatisticsByYear,
);

merchantDashboardRouter.get(
  "/peak-hours",
  validate(merchantPeakHoursSchema),
  getMerchantPeakHoursByYear,
);

merchantDashboardRouter.get(
  "/weekday-statistics",
  validate(merchantWeekdayStatisticsSchema),
  getMerchantWeekdayStatisticsByYear,
);

merchantDashboardRouter.get(
  "/order-performance",
  validate(merchantOrderPerformanceSchema),
  getMerchantOrderPerformanceByYear,
);

merchantDashboardRouter.get(
  "/daily-revenue",
  validate(merchantDailyRevenueSchema),
  getMerchantDailyRevenue,
);
