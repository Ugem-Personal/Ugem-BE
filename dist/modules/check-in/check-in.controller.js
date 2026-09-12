import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as checkInService from "./check-in.service.js";
const getMerchantId = (req) => {
    const merchantId = req.user?.MerchantId;
    if (!merchantId) {
        throw new AppError(403, "Tài khoản không có MerchantId");
    }
    return merchantId;
};
const getCustomerId = (req) => {
    const customerId = req.user?.CustomerId;
    if (!customerId) {
        throw new AppError(403, "Tài khoản không có CustomerId");
    }
    return customerId;
};
export const generateCheckInQr = asyncHandler(async (req, res) => {
    const qrImage = await checkInService.generateCheckInQr(getMerchantId(req), String(req.query.orderId));
    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", qrImage.length.toString());
    res.setHeader("Cache-Control", "no-store");
    return res.send(qrImage);
});
export const verifyCheckIn = asyncHandler(async (req, res) => {
    const checkIn = await checkInService.verifyCheckIn(getCustomerId(req), req.body.orderId, req.body.checkInToken, req.body.latitude, req.body.longitude);
    return sendSuccess(res, {
        message: "Xác nhận check-in thành công",
        data: checkIn,
    });
});
export const getCurrentCheckIns = asyncHandler(async (req, res) => {
    const checkIns = await checkInService.getCurrentCheckIns(getCustomerId(req));
    return sendSuccess(res, {
        message: "Lấy lịch sử check-in thành công",
        data: checkIns,
    });
});
export const getMerchantCheckInStatistics = asyncHandler(async (req, res) => {
    const stats = await checkInService.getMerchantCheckInStatistics(getMerchantId(req));
    return sendSuccess(res, {
        message: "Lấy thống kê check-in nhà hàng thành công",
        data: stats,
    });
});
export const getMerchantCheckInHistory = asyncHandler(async (req, res) => {
    const history = await checkInService.getMerchantCheckInHistory(getMerchantId(req));
    return sendSuccess(res, {
        message: "Lấy lịch sử check-in nhà hàng thành công",
        data: history,
    });
});
export const getMyCheckInCode = asyncHandler(async (req, res) => {
    const userId = req.user?.UserId;
    if (!userId) {
        throw new AppError(401, "Bạn chưa đăng nhập");
    }
    const data = await checkInService.getCustomerCheckInCode(userId);
    return sendSuccess(res, {
        message: "Lấy mã check-in tích điểm thành công",
        data,
    });
});
export const merchantVerifyCustomerCode = asyncHandler(async (req, res) => {
    const merchantId = getMerchantId(req);
    const { customerCode, rewardBenefit, notes } = req.body;
    const result = await checkInService.merchantVerifyCustomerCode(merchantId, customerCode, rewardBenefit, notes);
    return sendSuccess(res, {
        message: `Xác nhận check-in cho khách hàng ${result.customerName} thành công!`,
        data: result,
    });
});
