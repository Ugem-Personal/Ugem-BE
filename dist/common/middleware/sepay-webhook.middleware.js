import crypto from "node:crypto";
import { AppError } from "../errors/app-error.js";
import { env } from "../../config/env.js";
function secureEqual(received, expected) {
    const receivedHash = crypto.createHash("sha256").update(received).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(receivedHash, expectedHash);
}
export function authenticateSepayWebhook(req, _res, next) {
    const authorization = req.get("authorization") ?? "";
    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    if (scheme?.toLowerCase() !== "apikey" ||
        !token ||
        !secureEqual(token, env.SEPAY_WEBHOOK_API_KEY)) {
        throw new AppError(401, "Webhook SePay không hợp lệ");
    }
    next();
}
