import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";

import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  getMerchantCampaigns,
  getMyCampaigns,
  updateCampaign,
  updateCampaignByBody,
  updateCampaignStatus,
} from "./campaign.controller.js";

import {
  campaignIdSchema,
  createCampaignSchema,
  merchantCampaignSchema,
  updateCampaignByBodySchema,
  updateCampaignSchema,
} from "./campaign.schema.js";
import { validate } from "../../common/middleware/validate.middleware.js";

export const campaignRouter = Router();

campaignRouter.get(
  "/merchant/:merchantId",
  validate(merchantCampaignSchema),
  getMerchantCampaigns,
);

campaignRouter.get(
  "/me",
  authenticate,
  requireApprovedMerchant,
  getMyCampaigns,
);

campaignRouter.get("/", authenticate, requireApprovedMerchant, getMyCampaigns);

campaignRouter.post(
  "/",
  authenticate,
  requireApprovedMerchant,
  validate(createCampaignSchema),
  createCampaign,
);

campaignRouter.put(
  "/",
  authenticate,
  requireApprovedMerchant,
  validate(updateCampaignByBodySchema),
  updateCampaignByBody,
);

campaignRouter.put(
  "/:id",
  authenticate,
  requireApprovedMerchant,
  validate(updateCampaignSchema),
  updateCampaign,
);

campaignRouter.patch(
  "/:id/status",
  authenticate,
  requireApprovedMerchant,
  validate(updateCampaignSchema),
  updateCampaignStatus,
);

campaignRouter.delete(
  "/:id",
  authenticate,
  requireApprovedMerchant,
  validate(campaignIdSchema),
  deleteCampaign,
);

campaignRouter.get("/:id", validate(campaignIdSchema), getCampaignById);
