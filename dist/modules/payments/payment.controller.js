import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as paymentService from "./payment.service.js";
const getCustomerId = (req) => {
    if (!req.user?.CustomerId) {
        throw new AppError(403, "Tài khoản không có CustomerId");
    }
    return req.user.CustomerId;
};
const getMerchantId = (req) => {
    if (!req.user?.MerchantId) {
        throw new AppError(403, "Hồ sơ Merchant chưa được duyệt");
    }
    return req.user.MerchantId;
};
const getParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== "string") {
        throw new AppError(400, `Thiếu tham số ${name}`);
    }
    return value;
};
export const requestCashConfirmation = asyncHandler(async (req, res) => {
    const bill = await paymentService.requestCashConfirmation(getCustomerId(req), getParam(req, "orderId"));
    return sendSuccess(res, {
        message: "Đã gửi yêu cầu xác nhận thanh toán tiền mặt",
        data: bill,
    });
});
export const confirmCashPayment = asyncHandler(async (req, res) => {
    const bill = await paymentService.confirmCashPayment(getMerchantId(req), getParam(req, "orderId"));
    return sendSuccess(res, {
        message: "Xác nhận thanh toán tiền mặt thành công",
        data: bill,
    });
});
export const submitBill = asyncHandler(async (req, res) => {
    const bill = await paymentService.submitBill(getMerchantId(req), req.body);
    return sendSuccess(res, {
        message: "Gửi hóa đơn thành công",
        data: bill,
    });
});
export const getCustomerBills = asyncHandler(async (req, res) => {
    const bills = await paymentService.getCustomerBills(getCustomerId(req), req.query.orderId);
    return sendSuccess(res, {
        message: "Lấy hóa đơn thành công",
        data: bills,
    });
});
export const confirmBill = asyncHandler(async (req, res) => {
    const bill = await paymentService.confirmBill(getCustomerId(req), req.body);
    return sendSuccess(res, {
        message: "Xác nhận hóa đơn thành công",
        data: bill,
    });
});
export const rejectBill = asyncHandler(async (req, res) => {
    const bill = await paymentService.rejectBill(getCustomerId(req), req.body);
    return sendSuccess(res, {
        message: "Từ chối hóa đơn thành công",
        data: bill,
    });
});
export const processSepayWebhook = asyncHandler(async (req, res) => {
    const bill = await paymentService.processSepayWebhook(req.body);
    return sendSuccess(res, {
        message: "Xử lý giao dịch SePay thành công",
        data: bill,
    });
});
