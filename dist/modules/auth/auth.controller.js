import { sendSuccess } from "../../common/utils/api-response.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import * as authService from "./auth.service.js";
import { clearRefreshTokenCookie, setRefreshTokenCookie, } from "./auth-cookie.js";
const secureSessionResult = (res, result) => {
    setRefreshTokenCookie(res, result.refreshToken);
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
};
export const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    const safeResult = secureSessionResult(res, result);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Đăng ký tài khoản thành công",
        data: safeResult,
    });
});
export const login = asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    const safeResult = secureSessionResult(res, result);
    return sendSuccess(res, {
        message: "Đăng nhập thành công",
        data: safeResult,
    });
});
export const refreshToken = asyncHandler(async (req, res) => {
    const result = await authService.refreshAccessToken(req.body);
    const safeResult = secureSessionResult(res, result);
    return sendSuccess(res, {
        message: "Làm mới access token thành công",
        data: safeResult,
    });
});
export const googleLogin = asyncHandler(async (req, res) => {
    const result = await authService.googleLogin(req.body);
    const safeResult = secureSessionResult(res, result);
    return sendSuccess(res, {
        message: "Đăng nhập Google thành công",
        data: safeResult,
    });
});
export const logout = asyncHandler(async (req, res) => {
    await authService.revokeRefreshToken(req.body.refreshToken);
    clearRefreshTokenCookie(res);
    return sendSuccess(res, {
        message: "Dang xuat thanh cong",
        data: null,
    });
});
export const forgotPassword = asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body);
    return sendSuccess(res, {
        message: "Nếu email tồn tại, mã xác nhận đã được gửi đến email của bạn",
        data: null,
    });
});
export const verifyResetCode = asyncHandler(async (req, res) => {
    await authService.verifyResetCode(req.body);
    return sendSuccess(res, {
        message: "Mã xác nhận hợp lệ",
        data: null,
    });
});
export const resetPassword = asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    return sendSuccess(res, {
        message: "Đặt lại mật khẩu thành công",
        data: null,
    });
});
