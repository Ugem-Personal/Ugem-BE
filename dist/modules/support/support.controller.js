import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as supportService from "./support.service.js";
function getUserId(req) {
    if (!req.user?.UserId)
        throw new AppError(401, "Không xác định được người dùng");
    return req.user.UserId;
}
function getMerchantId(req) {
    if (!req.user?.MerchantId)
        throw new AppError(403, "Tài khoản không có MerchantId");
    return req.user.MerchantId;
}
function getId(req) {
    const id = req.params.id;
    if (typeof id !== "string" || !id)
        throw new AppError(400, "Thiếu mã yêu cầu hỗ trợ");
    return id;
}
export const createTicket = asyncHandler(async (req, res) => {
    const ticket = await supportService.createTicket(getMerchantId(req), getUserId(req), req.body);
    return sendSuccess(res, { statusCode: 201, message: "Tạo yêu cầu hỗ trợ thành công", data: ticket });
});
export const getMerchantTickets = asyncHandler(async (req, res) => {
    const tickets = await supportService.getMerchantTickets(getMerchantId(req), {
        status: req.query.status,
    });
    return sendSuccess(res, { message: "Lấy yêu cầu hỗ trợ thành công", data: tickets });
});
export const getMerchantTicket = asyncHandler(async (req, res) => {
    const ticket = await supportService.getMerchantTicket(getMerchantId(req), getId(req));
    return sendSuccess(res, { message: "Lấy chi tiết yêu cầu hỗ trợ thành công", data: ticket });
});
export const addMerchantMessage = asyncHandler(async (req, res) => {
    const ticket = await supportService.addMerchantMessage(getMerchantId(req), getUserId(req), getId(req), req.body);
    return sendSuccess(res, { message: "Đã gửi phản hồi hỗ trợ", data: ticket });
});
export const updateMerchantStatus = asyncHandler(async (req, res) => {
    const ticket = await supportService.updateMerchantStatus(getMerchantId(req), getId(req), req.body);
    return sendSuccess(res, { message: "Đã cập nhật trạng thái yêu cầu", data: ticket });
});
export const getStaffTickets = asyncHandler(async (req, res) => {
    const tickets = await supportService.getStaffTickets({ status: req.query.status });
    return sendSuccess(res, { message: "Lấy danh sách hỗ trợ thành công", data: tickets });
});
export const getStaffTicket = asyncHandler(async (req, res) => {
    const ticket = await supportService.getStaffTicket(getId(req));
    return sendSuccess(res, { message: "Lấy chi tiết hỗ trợ thành công", data: ticket });
});
export const addStaffMessage = asyncHandler(async (req, res) => {
    const ticket = await supportService.addStaffMessage(getUserId(req), getId(req), req.body);
    return sendSuccess(res, { message: "Đã gửi phản hồi cho Merchant", data: ticket });
});
export const updateStaffStatus = asyncHandler(async (req, res) => {
    const ticket = await supportService.updateStaffStatus(getUserId(req), getId(req), req.body);
    return sendSuccess(res, { message: "Đã cập nhật trạng thái hỗ trợ", data: ticket });
});
export const assignStaff = asyncHandler(async (req, res) => {
    const ticket = await supportService.assignStaff(getUserId(req), getId(req));
    return sendSuccess(res, { message: "Đã nhận yêu cầu hỗ trợ", data: ticket });
});
