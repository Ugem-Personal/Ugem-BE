import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as customerService from "./customer.service.js";
const getCustomerId = (req) => {
    const customerId = req.user?.CustomerId;
    if (!customerId) {
        throw new AppError(403, "Tài khoản không có CustomerId");
    }
    return customerId;
};
export const searchCustomersByEmail = asyncHandler(async (req, res) => {
    const customers = await customerService.searchCustomersByEmail({
        email: String(req.query.email),
        limit: Number(req.query.limit),
    });
    return sendSuccess(res, {
        message: "Tìm khách hàng theo email thành công",
        data: customers,
    });
});
export const searchCustomersByPhoneNumber = asyncHandler(async (req, res) => {
    const customers = await customerService.searchCustomersByPhoneNumber({
        phoneNumber: String(req.query.phoneNumber),
        limit: Number(req.query.limit),
    });
    return sendSuccess(res, {
        message: "Tìm khách hàng theo số điện thoại thành công",
        data: customers,
    });
});
export const getCustomerPreferences = asyncHandler(async (req, res) => {
    const customerId = getCustomerId(req);
    const preferences = await customerService.getCustomerPreferences(customerId);
    return sendSuccess(res, {
        message: "Lấy sở thích ăn uống thành công",
        data: preferences,
    });
});
export const updateCustomerPreferences = asyncHandler(async (req, res) => {
    const customerId = getCustomerId(req);
    const preferences = await customerService.updateCustomerPreferences(customerId, req.body);
    return sendSuccess(res, {
        message: "Cập nhật sở thích ăn uống thành công",
        data: preferences,
    });
});
