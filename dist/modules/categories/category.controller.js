import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as categoryService from "./category.service.js";
const getParam = (req, name) => {
    const value = req.params[name];
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, `Missing route parameter: ${name}`);
    }
    return value;
};
export const getCategories = asyncHandler(async (_req, res) => {
    const categories = await categoryService.getCategories();
    return sendSuccess(res, {
        message: "Lấy danh sách danh mục thành công",
        data: categories,
    });
});
export const getAllCategoriesForManagement = asyncHandler(async (_req, res) => {
    const categories = await categoryService.getAllCategoriesForManagement();
    return sendSuccess(res, {
        message: "Lấy danh sách quản lý danh mục thành công",
        data: categories,
    });
});
export const createCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    return sendSuccess(res, {
        statusCode: 201,
        message: "Tạo danh mục thành công",
        data: category,
    });
});
export const updateCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.updateCategory(getParam(req, "id"), req.body);
    return sendSuccess(res, {
        message: "Cập nhật danh mục thành công",
        data: category,
    });
});
export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.deleteCategory(getParam(req, "id"));
    return sendSuccess(res, {
        message: "Xóa danh mục thành công",
        data: category,
    });
});
export const getChildCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.getChildCategories(getParam(req, "parentId"));
    return sendSuccess(res, {
        message: "Lấy danh mục con thành công",
        data: categories,
    });
});
