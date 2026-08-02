import { AppError } from "../errors/app-error.js";
import { sendError } from "../utils/api-response.js";
import multer from "multer";
import { logger } from "../utils/logger.js";
export const notFoundHandler = (req, res) => {
    return sendError(res, {
        statusCode: 404,
        message: `Không tìm thấy endpoint ${req.method} ${req.originalUrl}`,
    });
};
export const errorHandler = (error, _req, res, _next) => {
    if (error instanceof AppError) {
        sendError(res, {
            statusCode: error.statusCode,
            message: error.message,
            errors: error.errors,
        });
        return;
    }
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return sendError(res, {
                statusCode: 400,
                message: "Ảnh phải có dung lượng nhỏ hơn 5MB",
                errors: [
                    {
                        field: "file",
                        message: "Ảnh phải có dung lượng nhỏ hơn 5MB",
                    },
                ],
            });
        }
        return sendError(res, {
            statusCode: 400,
            message: "File tải lên không hợp lệ",
            errors: [
                {
                    field: "file",
                    message: error.message,
                },
            ],
        });
    }
    logger.error("http.request.failed", {
        traceId: res.locals.traceId ?? null,
        method: _req.method,
        path: _req.originalUrl.split("?")[0],
        error,
    });
    sendError(res, {
        statusCode: 500,
        message: "Internal Server Error",
    });
};
