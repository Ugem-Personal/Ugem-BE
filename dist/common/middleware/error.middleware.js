import { AppError } from "../errors/app-error.js";
import { sendError } from "../utils/api-response.js";
import multer from "multer";
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
            return res.status(400).json({
                success: false,
                message: "Ảnh phải có dung lượng nhỏ hơn 5MB",
                data: null,
                errors: [
                    {
                        field: "file",
                        message: "Ảnh phải có dung lượng nhỏ hơn 5MB",
                    },
                ],
                traceId: res.locals.traceId,
                timestampUtc: new Date().toISOString(),
            });
        }
        return res.status(400).json({
            success: false,
            message: "File tải lên không hợp lệ",
            data: null,
            errors: [
                {
                    field: "file",
                    message: error.message,
                },
            ],
            traceId: res.locals.traceId,
            timestampUtc: new Date().toISOString(),
        });
    }
    console.error(error);
    sendError(res, {
        statusCode: 500,
        message: "Internal Server Error",
    });
};
