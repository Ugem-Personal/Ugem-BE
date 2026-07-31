import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as foodService from "./food.service.js";
const getMerchantId = (req) => {
    const merchantId = req.user?.MerchantId;
    if (!merchantId) {
        throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
    }
    return merchantId;
};
const getParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, `Missing route parameter: ${name}`);
    }
    return value;
};
export const createFood = asyncHandler(async (req, res) => {
    const food = await foodService.createFood(getMerchantId(req), req.body);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tạo món ăn thành công",
        data: food,
    });
});
export const getMyFoods = asyncHandler(async (req, res) => {
    const foods = await foodService.getMyFoods(getMerchantId(req));
    return sendSuccess(res, {
        message: "Lấy thực đơn Merchant thành công",
        data: foods,
    });
});
export const getFoodsByMerchant = asyncHandler(async (req, res) => {
    const onlyAvailable = req.query.onlyAvailable !== "false";
    const foods = await foodService.getFoodsByMerchant(getParam(req, "merchantId"), onlyAvailable);
    return sendSuccess(res, {
        message: "Lấy thực đơn thành công",
        data: foods,
    });
});
export const getFoodById = asyncHandler(async (req, res) => {
    const food = await foodService.getFoodById(getParam(req, "id"));
    return sendSuccess(res, {
        message: "Lấy thông tin món ăn thành công",
        data: food,
    });
});
export const updateFood = asyncHandler(async (req, res) => {
    const food = await foodService.updateFood(getMerchantId(req), getParam(req, "id"), req.body);
    return sendSuccess(res, {
        message: "Cập nhật món ăn thành công",
        data: food,
    });
});
export const updateAvailability = asyncHandler(async (req, res) => {
    const food = await foodService.updateAvailability(getMerchantId(req), getParam(req, "id"), req.body.isAvailable);
    return sendSuccess(res, {
        message: "Cập nhật trạng thái món ăn thành công",
        data: food,
    });
});
export const deleteFood = asyncHandler(async (req, res) => {
    await foodService.deleteFood(getMerchantId(req), getParam(req, "id"));
    return sendSuccess(res, {
        message: "Xóa món ăn thành công",
        data: null,
    });
});
