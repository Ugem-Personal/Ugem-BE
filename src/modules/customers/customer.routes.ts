import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import { getProfile, updateProfile } from "../users/user.controller.js";
import { updateProfileSchema } from "../users/user.schema.js";

import {
  searchCustomersByEmail,
  searchCustomersByPhoneNumber,
} from "./customer.controller.js";

import {
  searchCustomersByEmailSchema,
  searchCustomersByPhoneNumberSchema,
} from "./customer.schema.js";

export const customerRouter = Router();

customerRouter.use(authenticate);

customerRouter.get(
  "/profile",
  authorizeRoles("Customer", "Reviewer"),
  getProfile,
);

customerRouter.patch(
  "/profile",
  authorizeRoles("Customer", "Reviewer"),
  validate(updateProfileSchema),
  updateProfile,
);

// Giữ lại để tương thích với client cũ.
customerRouter.put(
  "/profile",
  authorizeRoles("Customer", "Reviewer"),
  validate(updateProfileSchema),
  updateProfile,
);

/*
 * Hai API này được dùng khi Merchant tạo đơn cho Customer.
 */
customerRouter.get(
  "/search-by-email",
  requireApprovedMerchant,
  validate(searchCustomersByEmailSchema),
  searchCustomersByEmail,
);

customerRouter.get(
  "/search-by-phone-number",
  requireApprovedMerchant,
  validate(searchCustomersByPhoneNumberSchema),
  searchCustomersByPhoneNumber,
);
