import { rateLimit } from "express-rate-limit";
import { sendError } from "../utils/api-response.js";
const createLimiter = (windowMs, limit, message) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (_req, res) => sendError(res, {
        statusCode: 429,
        message,
        errors: [
            {
                code: "RATE_LIMITED",
                message,
            },
        ],
    }),
});
export const apiRateLimiter = createLimiter(15 * 60 * 1000, 500, "Qua nhieu yeu cau tu thiet bi nay");
export const authRateLimiter = createLimiter(15 * 60 * 1000, 10, "Ban da thu dang nhap qua nhieu lan");
export const registrationRateLimiter = createLimiter(60 * 60 * 1000, 5, "Ban da tao qua nhieu tai khoan trong thoi gian ngan");
export const passwordResetRateLimiter = createLimiter(60 * 60 * 1000, 5, "Ban da yeu cau dat lai mat khau qua nhieu lan");
export const refreshTokenRateLimiter = createLimiter(15 * 60 * 1000, 30, "Ban da lam moi phien dang nhap qua nhieu lan");
export const webhookRateLimiter = createLimiter(60 * 1000, 120, "Webhook dang gui qua nhieu yeu cau");
