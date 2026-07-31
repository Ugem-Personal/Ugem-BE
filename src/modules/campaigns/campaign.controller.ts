import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as campaignService from "./campaign.service.js";

const getMerchantId = (req: Request): string => {
  const merchantId = req.user?.MerchantId;

  if (!merchantId) {
    throw new AppError(403, "Hồ sơ Merchant chưa được phê duyệt");
  }

  return merchantId;
};

const getParam = (req: Request, name: string): string => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return value;
};

export const createCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const campaign = await campaignService.createCampaign(
      getMerchantId(req),
      req.body,
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Tạo Campaign thành công",
      data: campaign,
    });
  },
);

export const getMyCampaigns = asyncHandler(
  async (req: Request, res: Response) => {
    const campaigns = await campaignService.getMyCampaigns(getMerchantId(req));

    return sendSuccess(res, {
      message: "Lấy Campaign của Merchant thành công",
      data: campaigns,
    });
  },
);

export const getMerchantCampaigns = asyncHandler(
  async (req: Request, res: Response) => {
    const campaigns = await campaignService.getActiveCampaignsByMerchant(
      getParam(req, "merchantId"),
    );

    return sendSuccess(res, {
      message: "Lấy Campaign đang hoạt động thành công",
      data: campaigns,
    });
  },
);

export const getCampaignById = asyncHandler(
  async (req: Request, res: Response) => {
    const campaign = await campaignService.getCampaignById(getParam(req, "id"));

    return sendSuccess(res, {
      message: "Lấy Campaign thành công",
      data: campaign,
    });
  },
);

export const updateCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const campaign = await campaignService.updateCampaign(
      getMerchantId(req),
      getParam(req, "id"),
      req.body,
    );

    return sendSuccess(res, {
      message: "Cập nhật Campaign thành công",
      data: campaign,
    });
  },
);

export const updateCampaignStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const campaign = await campaignService.updateCampaignStatus(
      getMerchantId(req),
      getParam(req, "id"),
      req.body.isActive,
    );

    return sendSuccess(res, {
      message: "Cập nhật trạng thái Campaign thành công",
      data: campaign,
    });
  },
);

export const deleteCampaign = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await campaignService.deleteCampaign(
      getMerchantId(req),
      getParam(req, "id"),
    );

    return sendSuccess(res, {
      message: "Xóa Campaign thành công",
      data: result,
    });
  },
);

export const updateCampaignByBody = asyncHandler(
  async (req: Request, res: Response) => {
    const { id, ...input } = req.body;

    const campaign = await campaignService.updateCampaign(
      getMerchantId(req),
      id,
      input,
    );

    return sendSuccess(res, {
      message: "Cập nhật Campaign thành công",
      data: campaign,
    });
  },
);
