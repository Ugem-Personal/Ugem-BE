import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import { getCustomerDashboard as getCustomerDashboardService, getMerchantDashboard as getMerchantDashboardService, getReviewerDashboard as getReviewerDashboardService, getStaffDashboard as getStaffDashboardService, getStaffRevenueByYear as getStaffRevenueByYearService, getMerchantRevenueByYear as getMerchantRevenueByYearService, getMerchantTopFoods as getMerchantTopFoodsService, getMerchantRecentOrders as getMerchantRecentOrdersService, getCustomerRecentOrders as getCustomerRecentOrdersService, getReviewerRecentEarnings as getReviewerRecentEarningsService, getStaffRecentOrders as getStaffRecentOrdersService, getStaffTopMerchants as getStaffTopMerchantsService, getStaffTopReviewers as getStaffTopReviewersService, getStaffTopFoods as getStaffTopFoodsService, getCustomerSpendingByYear as getCustomerSpendingByYearService, getReviewerEarningsByYear as getReviewerEarningsByYearService, getStaffUserGrowthByYear as getStaffUserGrowthByYearService, getStaffOrderGrowthByYear as getStaffOrderGrowthByYearService, getMerchantOrderGrowthByYear as getMerchantOrderGrowthByYearService, getCustomerOrderGrowthByYear as getCustomerOrderGrowthByYearService, getReviewerAffiliateGrowthByYear as getReviewerAffiliateGrowthByYearService, getMerchantCampaignPerformance as getMerchantCampaignPerformanceService, getMerchantReviewStatistics as getMerchantReviewStatisticsService, getStaffReviewStatistics as getStaffReviewStatisticsService, getStaffPaymentStatisticsByYear as getStaffPaymentStatisticsByYearService, getMerchantPaymentStatisticsByYear as getMerchantPaymentStatisticsByYearService, getCustomerPaymentStatisticsByYear as getCustomerPaymentStatisticsByYearService, getMerchantCustomerStatisticsByYear as getMerchantCustomerStatisticsByYearService, getMerchantPeakHoursByYear as getMerchantPeakHoursByYearService, getMerchantWeekdayStatisticsByYear as getMerchantWeekdayStatisticsByYearService, getCustomerFavoriteMerchantsByYear as getCustomerFavoriteMerchantsByYearService, getStaffPeakHoursByYear as getStaffPeakHoursByYearService, getStaffWeekdayStatisticsByYear as getStaffWeekdayStatisticsByYearService, getCustomerWeekdayStatisticsByYear as getCustomerWeekdayStatisticsByYearService, getCustomerPeakHoursByYear as getCustomerPeakHoursByYearService, getMerchantOrderPerformanceByYear as getMerchantOrderPerformanceByYearService, getStaffOrderPerformanceByYear as getStaffOrderPerformanceByYearService, getCustomerOrderPerformanceByYear as getCustomerOrderPerformanceByYearService, getStaffDailyRevenue as getStaffDailyRevenueService, getMerchantDailyRevenue as getMerchantDailyRevenueService, getCustomerDailySpending as getCustomerDailySpendingService, } from "./services/index.js";
const getMerchantId = (req) => {
    const merchantId = req.user?.MerchantId;
    if (!merchantId) {
        throw new AppError(403, "Tài khoản không có MerchantId");
    }
    return merchantId;
};
export const getMerchantDashboard = asyncHandler(async (req, res) => {
    const dashboard = await getMerchantDashboardService(getMerchantId(req));
    return sendSuccess(res, {
        message: "Lấy Dashboard Merchant thành công",
        data: dashboard,
    });
});
const getCustomerId = (req) => {
    const customerId = req.user?.CustomerId;
    if (!customerId) {
        throw new AppError(403, "Tài khoản không có CustomerId");
    }
    return customerId;
};
export const getCustomerDashboard = asyncHandler(async (req, res) => {
    const dashboard = await getCustomerDashboardService(getCustomerId(req));
    return sendSuccess(res, {
        message: "Lấy Dashboard Customer thành công",
        data: dashboard,
    });
});
const getReviewerId = (req) => {
    const reviewerId = req.user?.CustomerId;
    if (!reviewerId) {
        throw new AppError(403, "Tài khoản không có Reviewer ID");
    }
    if (req.user?.Role !== "Reviewer") {
        throw new AppError(403, "Chức năng chỉ dành cho Reviewer");
    }
    return reviewerId;
};
export const getReviewerDashboard = asyncHandler(async (req, res) => {
    const dashboard = await getReviewerDashboardService(getReviewerId(req));
    return sendSuccess(res, {
        message: "Lấy Dashboard Reviewer thành công",
        data: dashboard,
    });
});
export const getStaffDashboard = asyncHandler(async (_req, res) => {
    const dashboard = await getStaffDashboardService();
    return sendSuccess(res, {
        message: "Lấy Dashboard Staff thành công",
        data: dashboard,
    });
});
export const getStaffRevenueByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffRevenueByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê doanh thu theo tháng thành công",
        data: result,
    });
});
export const getMerchantRevenueByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantRevenueByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy doanh thu Merchant theo tháng thành công",
        data: result,
    });
});
export const getMerchantTopFoods = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getMerchantTopFoodsService(getMerchantId(req), limit);
    return sendSuccess(res, {
        message: "Lấy danh sách món bán chạy thành công",
        data: result,
    });
});
export const getMerchantRecentOrders = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getMerchantRecentOrdersService(getMerchantId(req), limit);
    return sendSuccess(res, {
        message: "Lấy đơn hàng gần đây thành công",
        data: result,
    });
});
export const getCustomerRecentOrders = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getCustomerRecentOrdersService(getCustomerId(req), limit);
    return sendSuccess(res, {
        message: "Lấy đơn hàng gần đây của Customer thành công",
        data: result,
    });
});
export const getReviewerRecentEarnings = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getReviewerRecentEarningsService(getReviewerId(req), limit);
    return sendSuccess(res, {
        message: "Lấy giao dịch hoa hồng gần đây thành công",
        data: result,
    });
});
export const getStaffRecentOrders = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);
    const result = await getStaffRecentOrdersService(limit);
    return sendSuccess(res, {
        message: "Lấy đơn hàng gần đây của hệ thống thành công",
        data: result,
    });
});
export const getStaffTopMerchants = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getStaffTopMerchantsService(limit);
    return sendSuccess(res, {
        message: "Lấy danh sách Merchant có doanh thu cao nhất thành công",
        data: result,
    });
});
export const getStaffTopReviewers = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    const result = await getStaffTopReviewersService(limit);
    return sendSuccess(res, {
        message: "Lấy danh sách Reviewer có thu nhập cao nhất thành công",
        data: result,
    });
});
export const getStaffTopFoods = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);
    const result = await getStaffTopFoodsService(limit);
    return sendSuccess(res, {
        message: "Lấy danh sách món ăn bán chạy toàn hệ thống thành công",
        data: result,
    });
});
export const getCustomerSpendingByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerSpendingByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê chi tiêu theo tháng thành công",
        data: result,
    });
});
export const getReviewerEarningsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getReviewerEarningsByYearService(getReviewerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê hoa hồng theo tháng thành công",
        data: result,
    });
});
export const getStaffUserGrowthByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffUserGrowthByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê tăng trưởng người dùng thành công",
        data: result,
    });
});
export const getStaffOrderGrowthByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffOrderGrowthByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê tăng trưởng đơn hàng thành công",
        data: result,
    });
});
export const getMerchantOrderGrowthByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantOrderGrowthByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê đơn hàng Merchant theo tháng thành công",
        data: result,
    });
});
export const getCustomerOrderGrowthByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerOrderGrowthByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê đơn hàng Customer theo tháng thành công",
        data: result,
    });
});
export const getReviewerAffiliateGrowthByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getReviewerAffiliateGrowthByYearService(getReviewerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê Affiliate theo tháng thành công",
        data: result,
    });
});
export const getMerchantCampaignPerformance = asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);
    const result = await getMerchantCampaignPerformanceService(getMerchantId(req), limit);
    return sendSuccess(res, {
        message: "Lấy thống kê hiệu quả Campaign thành công",
        data: result,
    });
});
export const getMerchantReviewStatistics = asyncHandler(async (req, res) => {
    const result = await getMerchantReviewStatisticsService(getMerchantId(req));
    return sendSuccess(res, {
        message: "Lấy thống kê đánh giá Merchant thành công",
        data: result,
    });
});
export const getStaffReviewStatistics = asyncHandler(async (_req, res) => {
    const result = await getStaffReviewStatisticsService();
    return sendSuccess(res, {
        message: "Lấy thống kê Review toàn hệ thống thành công",
        data: result,
    });
});
export const getStaffPaymentStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffPaymentStatisticsByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê phương thức thanh toán thành công",
        data: result,
    });
});
export const getMerchantPaymentStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantPaymentStatisticsByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê phương thức thanh toán Merchant thành công",
        data: result,
    });
});
export const getCustomerPaymentStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerPaymentStatisticsByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê phương thức thanh toán Customer thành công",
        data: result,
    });
});
export const getMerchantCustomerStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const limit = Number(req.query.limit ?? 10);
    const result = await getMerchantCustomerStatisticsByYearService(getMerchantId(req), year, limit);
    return sendSuccess(res, {
        message: "Lấy thống kê khách hàng Merchant thành công",
        data: result,
    });
});
export const getMerchantPeakHoursByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantPeakHoursByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê khung giờ đặt món thành công",
        data: result,
    });
});
export const getMerchantWeekdayStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantWeekdayStatisticsByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê đơn hàng theo ngày trong tuần thành công",
        data: result,
    });
});
export const getCustomerFavoriteMerchantsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const limit = Number(req.query.limit ?? 5);
    const result = await getCustomerFavoriteMerchantsByYearService(getCustomerId(req), year, limit);
    return sendSuccess(res, {
        message: "Lấy danh sách Merchant yêu thích thành công",
        data: result,
    });
});
export const getStaffPeakHoursByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffPeakHoursByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê khung giờ đặt món toàn hệ thống thành công",
        data: result,
    });
});
export const getStaffWeekdayStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffWeekdayStatisticsByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê đơn hàng theo ngày trong tuần toàn hệ thống thành công",
        data: result,
    });
});
export const getCustomerWeekdayStatisticsByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerWeekdayStatisticsByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê ngày đặt món của Customer thành công",
        data: result,
    });
});
export const getCustomerPeakHoursByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerPeakHoursByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê khung giờ đặt món của Customer thành công",
        data: result,
    });
});
export const getMerchantOrderPerformanceByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getMerchantOrderPerformanceByYearService(getMerchantId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê hiệu suất đơn hàng Merchant thành công",
        data: result,
    });
});
export const getStaffOrderPerformanceByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getStaffOrderPerformanceByYearService(year);
    return sendSuccess(res, {
        message: "Lấy thống kê hiệu suất đơn hàng toàn hệ thống thành công",
        data: result,
    });
});
export const getCustomerOrderPerformanceByYear = asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear());
    const result = await getCustomerOrderPerformanceByYearService(getCustomerId(req), year);
    return sendSuccess(res, {
        message: "Lấy thống kê hiệu suất đơn hàng Customer thành công",
        data: result,
    });
});
export const getStaffDailyRevenue = asyncHandler(async (req, res) => {
    const startDate = String(req.query.startDate);
    const endDate = String(req.query.endDate);
    const result = await getStaffDailyRevenueService(startDate, endDate);
    return sendSuccess(res, {
        message: "Lấy thống kê doanh thu theo ngày thành công",
        data: result,
    });
});
export const getMerchantDailyRevenue = asyncHandler(async (req, res) => {
    const startDate = String(req.query.startDate);
    const endDate = String(req.query.endDate);
    const result = await getMerchantDailyRevenueService(getMerchantId(req), startDate, endDate);
    return sendSuccess(res, {
        message: "Lấy doanh thu theo ngày của Merchant thành công",
        data: result,
    });
});
export const getCustomerDailySpending = asyncHandler(async (req, res) => {
    const startDate = String(req.query.startDate);
    const endDate = String(req.query.endDate);
    const result = await getCustomerDailySpendingService(getCustomerId(req), startDate, endDate);
    return sendSuccess(res, {
        message: "Lấy thống kê chi tiêu theo ngày của Customer thành công",
        data: result,
    });
});
