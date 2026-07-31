import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import { prisma } from "../../config/prisma.js";
import * as toppingService from "./food-topping.service.js";
const getMerchantId = (req) => {
    if (!req.user?.MerchantId) {
        throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
    }
    return req.user.MerchantId;
};
const getParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, `Missing route parameter: ${name}`);
    }
    return value;
};
export const getToppingsByFood = asyncHandler(async (req, res) => {
    const toppings = await toppingService.getToppingsByFood(getParam(req, "foodId"));
    return sendSuccess(res, {
        message: "Lấy danh sách topping thành công",
        data: toppings,
    });
});
export const getMyFoodToppings = asyncHandler(async (req, res) => {
    const merchantId = getMerchantId(req);
    const food = await prisma.food.findUnique({
        where: {
            id: getParam(req, "foodId"),
        },
    });
    if (!food || food.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền xem topping của món ăn này");
    }
    const toppings = await toppingService.getToppingsByFood(getParam(req, "foodId"), true);
    return sendSuccess(res, {
        message: "Lấy danh sách topping thành công",
        data: toppings,
    });
});
export const createTopping = asyncHandler(async (req, res) => {
    const topping = await toppingService.createTopping(getMerchantId(req), req.body);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tạo topping thành công",
        data: topping,
    });
});
export const updateTopping = asyncHandler(async (req, res) => {
    const topping = await toppingService.updateTopping(getMerchantId(req), getParam(req, "id"), req.body);
    return sendSuccess(res, {
        message: "Cập nhật topping thành công",
        data: topping,
    });
});
export const deleteTopping = asyncHandler(async (req, res) => {
    await toppingService.deleteTopping(getMerchantId(req), getParam(req, "id"));
    return sendSuccess(res, {
        message: "Xóa topping thành công",
        data: null,
    });
});
export const updateToppingByBody = asyncHandler(async (req, res) => {
    const { foodToppingId, ...input } = req.body;
    const topping = await toppingService.updateTopping(getMerchantId(req), foodToppingId, input);
    return sendSuccess(res, {
        message: "Cập nhật topping thành công",
        data: topping,
    });
});
