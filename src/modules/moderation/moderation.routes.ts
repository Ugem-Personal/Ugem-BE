import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import * as controller from "./moderation.controller.js";

export const moderationRouter = Router();

moderationRouter.post(
  "/incidents",
  authenticate,
  authorizeRoles("Customer", "Reviewer", "Merchant"),
  controller.createIncident,
);
moderationRouter.get(
  "/incidents/mine",
  authenticate,
  authorizeRoles("Customer", "Reviewer", "Merchant"),
  controller.listMyIncidents,
);
moderationRouter.post(
  "/claims",
  authenticate,
  authorizeRoles("Customer", "Reviewer", "Merchant"),
  controller.createClaim,
);
moderationRouter.post(
  "/removal-requests",
  authenticate,
  authorizeRoles("Merchant"),
  requireApprovedMerchant,
  controller.createRemovalRequest,
);
moderationRouter.post(
  "/suggestions",
  authenticate,
  authorizeRoles("Customer", "Reviewer"),
  controller.createSuggestion,
);
moderationRouter.get(
  "/merchant/analytics",
  authenticate,
  requireApprovedMerchant,
  controller.getMerchantAnalytics,
);
moderationRouter.post(
  "/funnel/events",
  authenticate,
  controller.createFunnelEvent,
);
moderationRouter.get(
  "/merchant/fee-preview",
  authenticate,
  requireApprovedMerchant,
  controller.getFeePreview,
);

moderationRouter.use("/admin", authenticate, authorizeRoles("Admin", "Staff"));
moderationRouter.get(
  "/admin/incidents",
  controller.listModeration("incidents"),
);
moderationRouter.patch("/admin/incidents/:id", controller.reviewIncident);
moderationRouter.get("/admin/claims", controller.listModeration("claims"));
moderationRouter.patch("/admin/claims/:id", controller.reviewClaim);
moderationRouter.get(
  "/admin/removal-requests",
  controller.listModeration("removals"),
);
moderationRouter.patch("/admin/removal-requests/:id", controller.reviewRemoval);
moderationRouter.get(
  "/admin/suggestions",
  controller.listModeration("suggestions"),
);
moderationRouter.patch("/admin/suggestions/:id", controller.reviewSuggestion);
moderationRouter.get("/admin/funnel", controller.getFunnelSummary);
moderationRouter.get("/admin/fee-policies", controller.listFeePolicies);
moderationRouter.post("/admin/fee-policies", controller.upsertFeePolicy);
