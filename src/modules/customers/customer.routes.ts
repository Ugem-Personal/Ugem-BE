import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import { getProfile, updateProfile } from "../users/user.controller.js";
import { updateProfileSchema } from "../users/user.schema.js";

import {
  getCustomerPreferences,
  getMyRedeemedVouchers,
  getReviewerProfile,
  redeemVoucher,
  searchCustomersByEmail,
  searchCustomersByPhoneNumber,
  updateCustomerPreferences,
} from "./customer.controller.js";

import {
  redeemVoucherSchema,
  searchCustomersByEmailSchema,
  searchCustomersByPhoneNumberSchema,
  updateCustomerPreferencesSchema,
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

customerRouter.put(
  "/profile",
  authorizeRoles("Customer", "Reviewer"),
  validate(updateProfileSchema),
  updateProfile,
);

customerRouter.get(
  "/preferences",
  authorizeRoles("Customer", "Reviewer"),
  getCustomerPreferences,
);

customerRouter.get(
  "/reviewer-profile",
  authorizeRoles("Customer", "Reviewer"),
  getReviewerProfile,
);

customerRouter.post(
  "/redeem-voucher",
  authorizeRoles("Customer", "Reviewer"),
  validate(redeemVoucherSchema),
  redeemVoucher,
);

customerRouter.get(
  "/my-vouchers",
  authorizeRoles("Customer", "Reviewer"),
  getMyRedeemedVouchers,
);

customerRouter.patch(
  "/preferences",
  authorizeRoles("Customer", "Reviewer"),
  validate(updateCustomerPreferencesSchema),
  updateCustomerPreferences,
);

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
