import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as categoryService from "./category.service.js";

const getParam = (req: Request, name: string) => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return value;
};

export const getCategories = asyncHandler(
  async (_req: Request, res: Response) => {
    const categories = await categoryService.getCategories();

    return sendSuccess(res, {
      message: "Lấy danh sách danh mục thành công",
      data: categories,
    });
  },
);

export const getDiscoveryOptions = asyncHandler(
  async (_req: Request, res: Response) => {
    const options = await categoryService.getDiscoveryOptions();

    return sendSuccess(res, {
      message: "Lấy bộ lọc khám phá thành công",
      data: options,
    });
  },
);

export const getAllCategoriesForManagement = asyncHandler(
  async (_req: Request, res: Response) => {
    const categories = await categoryService.getAllCategoriesForManagement();

    return sendSuccess(res, {
      message: "Lấy danh sách quản lý danh mục thành công",
      data: categories,
    });
  },
);

export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await categoryService.createCategory(req.body);

    return sendSuccess(res, {
      statusCode: 201,
      message: "Tạo danh mục thành công",
      data: category,
    });
  },
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await categoryService.updateCategory(
      getParam(req, "id"),
      req.body,
    );

    return sendSuccess(res, {
      message: "Cập nhật danh mục thành công",
      data: category,
    });
  },
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await categoryService.deleteCategory(getParam(req, "id"));

    return sendSuccess(res, {
      message: "Xóa danh mục thành công",
      data: category,
    });
  },
);

export const getChildCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const categories = await categoryService.getChildCategories(
      getParam(req, "parentId"),
    );

    return sendSuccess(res, {
      message: "Lấy danh mục con thành công",
      data: categories,
    });
  },
);
