import { cloudinary } from "../../config/cloudinary.js";
import { AppError } from "../../common/errors/app-error.js";
export const uploadImage = async (file) => {
    if (!file.buffer?.length) {
        throw new AppError(400, "File ảnh không có dữ liệu");
    }
    const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            folder: "ugem/images",
            resource_type: "image",
            /*
             * Giữ ảnh trong phạm vi hợp lý.
             * Cloudinary chỉ resize nếu ảnh quá lớn.
             */
            transformation: [
                {
                    width: 2000,
                    height: 2000,
                    crop: "limit",
                    quality: "auto",
                    fetch_format: "auto",
                },
            ],
        }, (error, result) => {
            if (error) {
                reject(error);
                return;
            }
            if (!result) {
                reject(new Error("Cloudinary không trả kết quả tải ảnh"));
                return;
            }
            resolve(result);
        });
        uploadStream.end(file.buffer);
    });
    if (!uploadResult.secure_url) {
        throw new AppError(500, "Không nhận được URL ảnh sau khi tải lên");
    }
    return uploadResult.secure_url;
};
