import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as reviewService from "./review.service.js";
const getCustomerId = (req) => {
    const customerId = req.user?.CustomerId;
    if (!customerId) {
        throw new AppError(403, "Tài khoản không có CustomerId");
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
export const createReview = asyncHandler(async (req, res) => {
    const review = await reviewService.createReview(getCustomerId(req), req.body);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tạo Review thành công",
        data: review,
    });
});
export const getMerchantReviews = asyncHandler(async (req, res) => {
    const result = await reviewService.getMerchantReviews(getParam(req, "merchantId"), {
        pageIndex: Number(req.query.pageIndex ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
    });
    return sendSuccess(res, {
        message: "Lấy danh sách Review thành công",
        data: result,
    });
});
export const getMyReviews = asyncHandler(async (req, res) => {
    const reviews = await reviewService.getMyReviews(getCustomerId(req));
    return sendSuccess(res, {
        message: "Lấy Review của tôi thành công",
        data: reviews,
    });
});
export const updateReview = asyncHandler(async (req, res) => {
    const review = await reviewService.updateReview(getCustomerId(req), getParam(req, "id"), req.body);
    return sendSuccess(res, {
        message: "Cập nhật Review thành công",
        data: review,
    });
});
export const deleteReview = asyncHandler(async (req, res) => {
    const result = await reviewService.deleteReview(getCustomerId(req), getParam(req, "id"));
    return sendSuccess(res, {
        message: "Xóa Review thành công",
        data: result,
    });
});
export const getMerchantReviewsByQuery = asyncHandler(async (req, res) => {
    const result = await reviewService.getMerchantReviews(String(req.query.merchantId), {
        pageIndex: Number(req.query.pageIndex ?? 1),
        pageSize: Number(req.query.pageSize ?? 100),
    });
    return sendSuccess(res, {
        message: "Lấy danh sách Review thành công",
        /*
         * FE hiện đọc data như Review[].
         */
        data: result.items,
    });
});
export const getReviewDetailsByQuery = asyncHandler(async (req, res) => {
    const details = await reviewService.getReviewDetails(String(req.query.reviewId));
    return sendSuccess(res, {
        message: "Lấy chi tiết Review thành công",
        data: details,
    });
});
export const updateReviewByBody = asyncHandler(async (req, res) => {
    const { reviewId, ...input } = req.body;
    const review = await reviewService.updateReview(getCustomerId(req), reviewId, input);
    return sendSuccess(res, {
        message: "Cập nhật Review thành công",
        data: review,
    });
});
