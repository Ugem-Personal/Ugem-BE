import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  getMerchantById,
  getMerchants,
  getMerchantsByCategory,
  getMerchantsForMap,
  getMyMerchant,
  getMyMerchantStatistics,
  getMyMerchantViews,
  getStaffMerchants,
  incrementMerchantView,
  updateMyMerchant,
} from "./merchant.controller.js";

import {
  merchantIdSchema,
  merchantListSchema,
  merchantMapSchema,
  merchantsByCategorySchema,
  staffMerchantListSchema,
  updateMerchantSchema,
} from "./merchant.schema.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";

export const merchantRouter = Router();

merchantRouter.get("/", validate(merchantListSchema), getMerchants);

merchantRouter.get("/map", validate(merchantMapSchema), getMerchantsForMap);

merchantRouter.get(
  "/by-category",
  validate(merchantsByCategorySchema),
  getMerchantsByCategory,
);

merchantRouter.get("/me", authenticate, requireApprovedMerchant, getMyMerchant);

merchantRouter.get(
  "/me/views",
  authenticate,
  requireApprovedMerchant,
  getMyMerchantViews,
);

merchantRouter.get(
  "/me/statistics",
  authenticate,
  requireApprovedMerchant,
  getMyMerchantStatistics,
);

merchantRouter.put(
  "/",
  authenticate,
  requireApprovedMerchant,
  validate(updateMerchantSchema),
  updateMyMerchant,
);
merchantRouter.get(
  "/staff",
  authenticate,
  authorizeRoles("Staff", "Admin"),
  validate(staffMerchantListSchema),
  getStaffMerchants,
);

merchantRouter.put(
  "/me",
  authenticate,
  requireApprovedMerchant,
  validate(updateMerchantSchema),
  updateMyMerchant,
);

merchantRouter.post(
  "/:id/views",
  validate(merchantIdSchema),
  incrementMerchantView,
);

merchantRouter.get("/:id", validate(merchantIdSchema), getMerchantById);
