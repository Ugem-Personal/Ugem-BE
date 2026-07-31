import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";

export const requireApprovedMerchant = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return next(new AppError(401, "Bạn chưa đăng nhập"));
  }

  if (req.user.Role !== "Merchant") {
    return next(new AppError(403, "Chức năng chỉ dành cho Merchant"));
  }

  if (!req.user.MerchantId) {
    return next(new AppError(403, "Hồ sơ Merchant chưa được phê duyệt"));
  }

  return next();
};
