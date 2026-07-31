import multer from "multer";
import { AppError } from "../../common/errors/app-error.js";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
]);
export const uploadImageMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        if (!allowedImageTypes.has(file.mimetype.toLowerCase())) {
            callback(new AppError(400, "Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WebP"));
            return;
        }
        callback(null, true);
    },
}).single("file");
