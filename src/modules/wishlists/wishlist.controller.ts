import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as wishlistService from "./wishlist.service.js";

const getCustomerId = (req: Request): string => {
  const customerId = req.user?.CustomerId;

  if (!customerId) {
    throw new AppError(403, "Tài khoản không có CustomerId");
  }

  return customerId;
};

const getParam = (req: Request, name: string): string => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return value;
};

const getMerchantIdFromBody = (req: Request): string => {
  const merchantId = req.body?.merchantId;

  if (typeof merchantId !== "string" || !merchantId.trim()) {
    throw new AppError(400, "Thiếu merchantId");
  }

  return merchantId;
};

export const getMyWishlists = asyncHandler(
  async (req: Request, res: Response) => {
    const wishlists = await wishlistService.getMyWishlists(getCustomerId(req));

    return sendSuccess(res, {
      message: "Lấy danh sách yêu thích thành công",
      data: wishlists,
    });
  },
);

export const addWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await wishlistService.addWishlist(
    getCustomerId(req),
    getMerchantIdFromBody(req),
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Thêm Merchant vào danh sách yêu thích thành công",
    data: wishlist,
  });
});

export const addWishlistByParam = asyncHandler(
  async (req: Request, res: Response) => {
    const wishlist = await wishlistService.addWishlist(
      getCustomerId(req),
      getParam(req, "merchantId"),
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Thêm Merchant vào danh sách yêu thích thành công",
      data: wishlist,
    });
  },
);

export const removeWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await wishlistService.removeWishlist(
      getCustomerId(req),
      getParam(req, "merchantId"),
    );

    return sendSuccess(res, {
      message: "Xóa Merchant khỏi danh sách yêu thích thành công",
      data: result,
    });
  },
);

export const checkWishlist = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await wishlistService.checkWishlist(
      getCustomerId(req),
      getParam(req, "merchantId"),
    );

    return sendSuccess(res, {
      message: "Kiểm tra trạng thái yêu thích thành công",
      data: result,
    });
  },
);
