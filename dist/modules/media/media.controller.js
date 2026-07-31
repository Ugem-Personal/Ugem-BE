import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as mediaService from "./media.service.js";
export const uploadImage = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError(400, "Vui lòng chọn một file ảnh");
    }
    const imageUrl = await mediaService.uploadImage(req.file);
    /*
     * FE hỗ trợ đúng dạng:
     * {
     *   success: true,
     *   data: "https://..."
     * }
     */
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tải ảnh lên thành công",
        data: imageUrl,
    });
});
