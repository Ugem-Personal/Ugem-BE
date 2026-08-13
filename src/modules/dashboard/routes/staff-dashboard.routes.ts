import { Router } from "express";

import { authenticate } from "../../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../../common/middleware/role.middleware.js";
import { validate } from "../../../common/middleware/validate.middleware.js";

import {
  getStaffDailyRevenue,
  getStaffDashboard,
  getStaffOrderGrowthByYear,
  getStaffOrderPerformanceByYear,
  getStaffPaymentStatisticsByYear,
  getStaffPeakHoursByYear,
  getStaffRecentOrders,
  getStaffRevenueByYear,
  getStaffReviewStatistics,
  getStaffTopFoods,
  getStaffTopMerchants,
  getStaffTopReviewers,
  getStaffUserGrowthByYear,
  getStaffWeekdayStatisticsByYear,
} from "../controllers/staff-dashboard.controller.js";

import {
  staffDailyRevenueSchema,
  staffOrderGrowthSchema,
  staffOrderPerformanceSchema,
  staffPaymentStatisticsSchema,
  staffPeakHoursSchema,
  staffRecentOrdersSchema,
  staffRevenueSchema,
  staffTopFoodsSchema,
  staffTopMerchantsSchema,
  staffTopReviewersSchema,
  staffUserGrowthSchema,
  staffWeekdayStatisticsSchema,
} from "../schemas/staff-dashboard.schema.js";

export const staffDashboardRouter = Router();

staffDashboardRouter.use(authenticate, authorizeRoles("Staff", "Admin"));

staffDashboardRouter.get("/", getStaffDashboard);

staffDashboardRouter.get(
  "/revenue",
  validate(staffRevenueSchema),
  getStaffRevenueByYear,
);

staffDashboardRouter.get(
  "/recent-orders",
  validate(staffRecentOrdersSchema),
  getStaffRecentOrders,
);

staffDashboardRouter.get(
  "/top-merchants",
  validate(staffTopMerchantsSchema),
  getStaffTopMerchants,
);

staffDashboardRouter.get(
  "/top-reviewers",
  validate(staffTopReviewersSchema),
  getStaffTopReviewers,
);

staffDashboardRouter.get(
  "/top-foods",
  validate(staffTopFoodsSchema),
  getStaffTopFoods,
);

staffDashboardRouter.get(
  "/user-growth",
  validate(staffUserGrowthSchema),
  getStaffUserGrowthByYear,
);

staffDashboardRouter.get(
  "/order-growth",
  validate(staffOrderGrowthSchema),
  getStaffOrderGrowthByYear,
);

staffDashboardRouter.get("/review-statistics", getStaffReviewStatistics);

staffDashboardRouter.get(
  "/payment-statistics",
  validate(staffPaymentStatisticsSchema),
  getStaffPaymentStatisticsByYear,
);

staffDashboardRouter.get(
  "/peak-hours",
  validate(staffPeakHoursSchema),
  getStaffPeakHoursByYear,
);

staffDashboardRouter.get(
  "/weekday-statistics",
  validate(staffWeekdayStatisticsSchema),
  getStaffWeekdayStatisticsByYear,
);

staffDashboardRouter.get(
  "/order-performance",
  validate(staffOrderPerformanceSchema),
  getStaffOrderPerformanceByYear,
);

staffDashboardRouter.get(
  "/daily-revenue",
  validate(staffDailyRevenueSchema),
  getStaffDailyRevenue,
);

staffDashboardRouter.get("/rebalancing", async (_req, res) => {
  const { getRebalancingStatus } = await import(
    "../../rebalancing/rebalancing.service.js"
  );
  const data = await getRebalancingStatus();
  return res.json({
    success: true,
    message: "Lấy dữ liệu rebalancing dashboard thành công",
    data,
  });
});
