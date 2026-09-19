import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import { paginationMeta } from "../../common/utils/pagination.js";

import * as merchantService from "./merchant.service.js";
import type { DiscoveryType } from "./merchant.types.js";

const getRouteId = (req: Request) => {
  const { id } = req.params;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError(400, "Missing route id");
  }

  return id;
};

const getMerchantId = (req: Request): string => {
  const merchantId = req.user?.MerchantId;

  if (!merchantId) {
    throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
  }

  return merchantId;
};

const getMerchantListQuery = (
  req: Request,
  discoveryType?: DiscoveryType,
) => ({
  customerId: req.user?.CustomerId ?? undefined,
  search: req.query.search as string | undefined,
  categoryId: req.query.categoryId as string | undefined,
  restaurantType: req.query.restaurantType as string | undefined,
  mainDishType: req.query.mainDishType as string | undefined,
  priceRange: req.query.priceRange as string | undefined,
  country: req.query.country as string | undefined,
  city: req.query.city as string | undefined,
  area: req.query.area as string | undefined,
  latitude:
    req.query.latitude !== undefined
      ? Number(req.query.latitude)
      : undefined,
  longitude:
    req.query.longitude !== undefined
      ? Number(req.query.longitude)
      : undefined,
  radiusKm:
    req.query.radiusKm !== undefined
      ? Number(req.query.radiusKm)
      : undefined,
  discoveryType:
    discoveryType ??
    (req.query.discoveryType as DiscoveryType | undefined),
  pageIndex: Number(req.query.pageIndex ?? 1),
  pageSize: Number(req.query.pageSize ?? 10),
});

export const getMerchants = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getMerchants(
      getMerchantListQuery(req),
    );

    return sendSuccess(res, {
      message: "Láº¥y danh sÃ¡ch Merchant thÃ nh cÃ´ng",
      data: result,
    });
  },
);

export const getSponsoredMerchants = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getMerchants(
      getMerchantListQuery(req, "Sponsored"),
    );

    return sendSuccess(res, {
      message: "Láº¥y danh sÃ¡ch Merchant Sponsored thÃ nh cÃ´ng",
      data: result,
    });
  },
);

export const getMerchantById = asyncHandler(
  async (req: Request, res: Response) => {
    const merchant = await merchantService.getMerchantById(getRouteId(req));

    return sendSuccess(res, {
      message: "Lấy thông tin Merchant thành công",
      data: merchant,
    });
  },
);

export const getMyMerchant = asyncHandler(
  async (req: Request, res: Response) => {
    const merchantId = req.user?.MerchantId;

    if (!merchantId) {
      throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
    }

    const merchant = await merchantService.getMyMerchant(merchantId);

    return sendSuccess(res, {
      message: "Lấy hồ sơ Merchant thành công",
      data: merchant,
    });
  },
);

export const updateMyMerchant = asyncHandler(
  async (req: Request, res: Response) => {
    const merchantId = req.user?.MerchantId;

    if (!merchantId) {
      throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
    }

    const merchant = await merchantService.updateMyMerchant(
      merchantId,
      req.body,
    );

    return sendSuccess(res, {
      message: "Cập nhật hồ sơ Merchant thành công",
      data: merchant,
    });
  },
);

export const getMerchantsForMap = asyncHandler(
  async (req: Request, res: Response) => {
    const merchants = await merchantService.getMerchantsForMap({
      minLongitude: Number(req.query.minLongitude ?? -180),

      maxLongitude: Number(req.query.maxLongitude ?? 180),

      minLatitude: Number(req.query.minLatitude ?? -90),

      maxLatitude: Number(req.query.maxLatitude ?? 90),

      zoomLevel: Number(req.query.zoomLevel ?? 20),
    });

    return sendSuccess(res, {
      message: "Lấy vị trí Merchant thành công",
      data: merchants,
    });
  },
);

export const incrementMerchantView = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.incrementMerchantView({
      merchantId: getRouteId(req),
      customerId: req.user?.CustomerId ?? undefined,
      source: req.body?.source,
    });

    return sendSuccess(res, {
      message: "Ghi nhận lượt xem Merchant thành công",
      data: result,
    });
  },
);

export const getMyMerchantViews = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getMyMerchantViews(getMerchantId(req));

    return sendSuccess(res, {
      message: "Lấy lượt xem Merchant thành công",
      data: result,
    });
  },
);

export const getMyMerchantStatistics = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getMyMerchantStatistics(
      getMerchantId(req),
    );

    return sendSuccess(res, {
      message: "Lấy thống kê Merchant thành công",
      data: result,
    });
  },
);

export const getStaffMerchants = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getStaffMerchants({
      searchTerm:
        typeof req.query.searchTerm === "string"
          ? req.query.searchTerm
          : undefined,

      pageIndex: Number(req.query.pageIndex ?? 1),

      pageSize: Number(req.query.pageSize ?? 10),
    });

    return sendSuccess(res, {
      message: "Lấy danh sách Merchant cho Staff thành công",
      data: result,
    });
  },
);

export const getMerchantsByCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await merchantService.getMerchants({
      customerId: req.user?.CustomerId ?? undefined,

      categoryId: String(req.query.categoryId),

      search:
        typeof req.query.search === "string" ? req.query.search : undefined,

      latitude:
        req.query.latitude !== undefined
          ? Number(req.query.latitude)
          : undefined,

      longitude:
        req.query.longitude !== undefined
          ? Number(req.query.longitude)
          : undefined,

      radiusKm:
        req.query.radiusKm !== undefined
          ? Number(req.query.radiusKm)
          : undefined,

      pageIndex: Number(req.query.pageIndex ?? 1),

      pageSize: Number(req.query.pageSize ?? 10),
    });

    return sendSuccess(res, {
      message: "Lấy Merchant theo Category thành công",
      data: result,
    });
  },
);

