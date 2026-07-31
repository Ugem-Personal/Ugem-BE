import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as userService from "./user.service.js";

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.UserId;

  if (!userId) {
    throw new AppError(401, "Không xác định được người dùng");
  }

  const profile = await userService.getProfile(userId);

  return sendSuccess(res, {
    message: "Lấy thông tin cá nhân thành công",
    data: profile,
  });
});

export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.UserId;

    if (!userId) {
      throw new AppError(401, "Không xác định được người dùng");
    }

    const profile = await userService.updateProfile(userId, req.body);

    return sendSuccess(res, {
      message: "Cập nhật thông tin cá nhân thành công",
      data: profile,
    });
  },
);
