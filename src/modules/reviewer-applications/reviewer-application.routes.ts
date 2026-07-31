import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  createReviewerApplication,
  getMyReviewerApplication,
  getReviewerApplications,
  reviewReviewerApplication,
  updateReviewerApplication,
} from "./reviewer-application.controller.js";

import {
  createReviewerApplicationSchema,
  reviewerApplicationListSchema,
  reviewReviewerApplicationSchema,
  updateReviewerApplicationSchema,
} from "./reviewer-application.schema.js";

export const reviewerApplicationRouter = Router();

reviewerApplicationRouter.use(authenticate);

reviewerApplicationRouter.post(
  "/",
  authorizeRoles("Customer"),
  validate(createReviewerApplicationSchema),
  createReviewerApplication,
);

reviewerApplicationRouter.get(
  "/",
  authorizeRoles("Customer", "Reviewer"),
  getMyReviewerApplication,
);

reviewerApplicationRouter.patch(
  "/",
  authorizeRoles("Customer"),
  validate(updateReviewerApplicationSchema),
  updateReviewerApplication,
);

reviewerApplicationRouter.get(
  "/all",
  authorizeRoles("Staff", "Admin"),
  validate(reviewerApplicationListSchema),
  getReviewerApplications,
);

reviewerApplicationRouter.patch(
  "/:id/status",
  authorizeRoles("Staff", "Admin"),
  validate(reviewReviewerApplicationSchema),
  reviewReviewerApplication,
);
