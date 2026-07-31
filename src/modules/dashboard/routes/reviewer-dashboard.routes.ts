import { Router } from "express";

import { authenticate } from "../../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../../common/middleware/role.middleware.js";
import { validate } from "../../../common/middleware/validate.middleware.js";

import {
  getReviewerAffiliateGrowthByYear,
  getReviewerDashboard,
  getReviewerEarningsByYear,
  getReviewerRecentEarnings,
} from "../controllers/reviewer-dashboard.controller.js";

import {
  reviewerAffiliateGrowthSchema,
  reviewerEarningsSchema,
  reviewerRecentEarningsSchema,
} from "../schemas/reviewer-dashboard.schema.js";

export const reviewerDashboardRouter = Router();

reviewerDashboardRouter.use(authenticate, authorizeRoles("Reviewer"));

reviewerDashboardRouter.get("/", getReviewerDashboard);

reviewerDashboardRouter.get(
  "/earnings",
  validate(reviewerEarningsSchema),
  getReviewerEarningsByYear,
);

reviewerDashboardRouter.get(
  "/recent-earnings",
  validate(reviewerRecentEarningsSchema),
  getReviewerRecentEarnings,
);

reviewerDashboardRouter.get(
  "/affiliate-growth",
  validate(reviewerAffiliateGrowthSchema),
  getReviewerAffiliateGrowthByYear,
);
