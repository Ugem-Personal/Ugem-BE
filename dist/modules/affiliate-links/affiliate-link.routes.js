import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { optionalAuthenticate } from "../../common/middleware/optional-auth.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";
import { createAffiliateLink, getMyAffiliateLinks, getReviewerEarnings, trackAffiliateLink, updateAffiliateLinkStatus, } from "./affiliate-link.controller.js";
import { affiliateCodeSchema, affiliateEarningsSchema, createAffiliateLinkSchema, updateAffiliateLinkStatusSchema, } from "./affiliate-link.schema.js";
export const affiliateLinkRouter = Router();
/*
 * Public hoặc có token đều dùng được.
 */
affiliateLinkRouter.get("/:code/track", optionalAuthenticate, validate(affiliateCodeSchema), trackAffiliateLink);
/*
 * Các route bên dưới bắt buộc đăng nhập.
 */
affiliateLinkRouter.use(authenticate);
affiliateLinkRouter.get("/mine", getMyAffiliateLinks);
affiliateLinkRouter.get("/earnings", validate(affiliateEarningsSchema), getReviewerEarnings);
affiliateLinkRouter.post("/", validate(createAffiliateLinkSchema), createAffiliateLink);
affiliateLinkRouter.patch("/:id/status", validate(updateAffiliateLinkStatusSchema), updateAffiliateLinkStatus);
