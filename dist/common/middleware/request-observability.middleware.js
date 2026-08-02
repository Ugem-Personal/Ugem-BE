import crypto from "node:crypto";
import { logger } from "../utils/logger.js";
const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;
export const resolveTraceId = (incomingRequestId) => {
    const candidate = incomingRequestId?.trim();
    return candidate && requestIdPattern.test(candidate)
        ? candidate
        : crypto.randomUUID();
};
export const requestObservability = (req, res, next) => {
    const traceId = resolveTraceId(req.get("x-request-id"));
    const startedAt = process.hrtime.bigint();
    res.locals.traceId = traceId;
    res.setHeader("X-Request-Id", traceId);
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const fields = {
            traceId,
            method: req.method,
            path: req.originalUrl.split("?")[0],
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            userId: req.user?.UserId ?? null,
            role: req.user?.Role ?? null,
        };
        if (res.statusCode >= 500) {
            logger.error("http.request.completed", fields);
        }
        else if (res.statusCode >= 400) {
            logger.warn("http.request.completed", fields);
        }
        else {
            logger.info("http.request.completed", fields);
        }
    });
    next();
};
