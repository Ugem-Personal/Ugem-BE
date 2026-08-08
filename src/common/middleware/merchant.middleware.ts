import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../config/prisma.js";
import { AppError } from "../errors/app-error.js";

export const requireApprovedMerchant = async (
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

  if (req.user.MerchantId) {
    return next();
  }

  try {
    const merchant = await prisma.merchant.findUnique({
      where: {
        userId: req.user.UserId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!merchant || merchant.status !== "Active") {
      return next(new AppError(403, "Hồ sơ Merchant chưa được phê duyệt"));
    }

    // Token có thể được cấp trước thời điểm Staff duyệt hồ sơ.
    // Đồng bộ MerchantId từ DB để phiên hiện tại dùng được ngay sau khi duyệt.
    req.user.MerchantId = merchant.id;

    return next();
  } catch (error) {
    return next(error);
  }
};
