import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  createCategory,
  deleteCategory,
  getAllCategoriesForManagement,
  getCategories,
  getChildCategories,
  getDiscoveryOptions,
  updateCategory,
} from "./category.controller.js";

import {
  categoryIdSchema,
  parentCategoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.schema.js";

export const categoryRouter = Router();

categoryRouter.get("/", getCategories);

categoryRouter.get("/discovery-options", getDiscoveryOptions);

categoryRouter.get(
  "/:parentId/children",
  validate(parentCategoryIdSchema),
  getChildCategories,
);

categoryRouter.get(
  "/management",
  authenticate,
  authorizeRoles("Staff", "Admin"),
  getAllCategoriesForManagement,
);

categoryRouter.post(
  "/",
  authenticate,
  authorizeRoles("Staff", "Admin"),
  validate(createCategorySchema),
  createCategory,
);

categoryRouter.put(
  "/:id",
  authenticate,
  authorizeRoles("Staff", "Admin"),
  validate(updateCategorySchema),
  updateCategory,
);

categoryRouter.delete(
  "/:id",
  authenticate,
  authorizeRoles("Staff", "Admin"),
  validate(categoryIdSchema),
  deleteCategory,
);
