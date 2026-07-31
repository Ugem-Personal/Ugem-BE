import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  createFood,
  deleteFood,
  getFoodById,
  getFoodsByMerchant,
  getMyFoods,
  updateAvailability,
  updateFood,
} from "./food.controller.js";

import {
  createFoodSchema,
  foodIdSchema,
  merchantFoodsSchema,
  updateAvailabilitySchema,
  updateFoodSchema,
} from "./food.schema.js";

export const foodRouter = Router();

foodRouter.get(
  "/merchant/me",
  authenticate,
  requireApprovedMerchant,
  getMyFoods,
);

foodRouter.get(
  "/merchant/:merchantId",
  validate(merchantFoodsSchema),
  getFoodsByMerchant,
);

foodRouter.get("/", authenticate, requireApprovedMerchant, getMyFoods);

foodRouter.post(
  "/",
  authenticate,
  requireApprovedMerchant,
  validate(createFoodSchema),
  createFood,
);

foodRouter.put(
  "/:id",
  authenticate,
  requireApprovedMerchant,
  validate(updateFoodSchema),
  updateFood,
);

foodRouter.patch(
  "/:id/availability",
  authenticate,
  requireApprovedMerchant,
  validate(updateAvailabilitySchema),
  updateAvailability,
);

foodRouter.delete(
  "/:id",
  authenticate,
  requireApprovedMerchant,
  validate(foodIdSchema),
  deleteFood,
);

foodRouter.get("/:id", validate(foodIdSchema), getFoodById);
