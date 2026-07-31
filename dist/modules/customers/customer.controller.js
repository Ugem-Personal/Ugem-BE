import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as customerService from "./customer.service.js";
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
