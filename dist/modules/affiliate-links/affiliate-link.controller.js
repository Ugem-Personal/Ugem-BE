import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as affiliateLinkService from "./affiliate-link.service.js";
const getReviewerId = (req) => {
    const customerId = req.user?.CustomerId;
    if (!customerId) {
        throw new AppError(403, "Tài khoản không có Reviewer ID");
    }
    if (req.user?.Role !== "Reviewer") {
        throw new AppError(403, "Chức năng chỉ dành cho Reviewer");
    }
    return customerId;
};
const getParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, `Missing route parameter: ${name}`);
    }
    return value;
};
export const createAffiliateLink = asyncHandler(async (req, res) => {
    const link = await affiliateLinkService.createAffiliateLink(getReviewerId(req), req.body);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tạo Affiliate Link thành công",
        data: link,
    });
});
export const getMyAffiliateLinks = asyncHandler(async (req, res) => {
    const links = await affiliateLinkService.getMyAffiliateLinks(getReviewerId(req));
    return sendSuccess(res, {
        message: "Lấy Affiliate Link thành công",
        data: links,
    });
});
export const updateAffiliateLinkStatus = asyncHandler(async (req, res) => {
    const link = await affiliateLinkService.updateAffiliateLinkStatus(getReviewerId(req), getParam(req, "id"), req.body);
    return sendSuccess(res, {
        message: "Cập nhật Affiliate Link thành công",
        data: link,
    });
});
export const trackAffiliateLink = asyncHandler(async (req, res) => {
    const result = await affiliateLinkService.trackAffiliateLink(getParam(req, "code"), {
        customerId: req.user?.CustomerId ?? null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
    });
    return sendSuccess(res, {
        message: "Ghi nhận Affiliate Link thành công",
        data: result,
    });
});
export const getReviewerEarnings = asyncHandler(async (req, res) => {
    const result = await affiliateLinkService.getReviewerEarnings(getReviewerId(req), {
        pageIndex: Number(req.query.pageIndex ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
    });
    return sendSuccess(res, {
        message: "Lấy thống kê thu nhập thành công",
        data: result,
    });
});
