import crypto from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import { verifyAccessToken } from "../../common/utils/jwt.js";
import { logger } from "../../common/utils/logger.js";
import { prisma } from "../../config/prisma.js";
import { realtimeService } from "./realtime.service.js";
export const handleRealtimeStream = async (req, res) => {
    // Extract token from Header or Query Param
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }
    else if (typeof req.query.token === "string" && req.query.token.trim()) {
        token = req.query.token.trim();
    }
    if (!token) {
        throw new AppError(401, "Bạn chưa cung cấp access token");
    }
    let payload;
    try {
        payload = verifyAccessToken(token);
    }
    catch {
        throw new AppError(401, "Access token không hợp lệ hoặc đã hết hạn");
    }
    const userId = payload.UserId;
    const role = payload.Role;
    let merchantId = payload.MerchantId ?? null;
    if (role === "Merchant" && !merchantId) {
        try {
            const merchant = await prisma.merchant.findUnique({
                where: { userId },
                select: { id: true },
            });
            if (merchant) {
                merchantId = merchant.id;
            }
        }
        catch (err) {
            logger.warn("realtime.merchant_lookup_failed", { userId, error: err });
        }
    }
    // Set SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const clientId = crypto.randomUUID();
    realtimeService.registerClient(clientId, res, userId, role, merchantId);
    // Handle client disconnect
    req.on("close", () => {
        realtimeService.unregisterClient(clientId);
    });
};
export const getRealtimeStatus = async (_req, res) => {
    res.json({
        success: true,
        data: {
            activeConnections: realtimeService.getActiveClientCount(),
            connectedUsers: realtimeService.getConnectedUserCount(),
        },
    });
};
