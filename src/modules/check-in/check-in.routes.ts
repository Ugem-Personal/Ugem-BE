import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  generateCheckInQr,
  getCurrentCheckIns,
  verifyCheckIn,
} from "./check-in.controller.js";

import {
  generateCheckInQrSchema,
  verifyCheckInSchema,
} from "./check-in.schema.js";

export const checkInRouter = Router();

checkInRouter.get(
  "/generate-qr",
  authenticate,
  requireApprovedMerchant,
  validate(generateCheckInQrSchema),
  generateCheckInQr,
);

checkInRouter.post(
  "/verify",
  authenticate,
  authorizeRoles("Customer", "Reviewer"),
  validate(verifyCheckInSchema),
  verifyCheckIn,
);

checkInRouter.get(
  "/current",
  authenticate,
  authorizeRoles("Customer", "Reviewer"),
  getCurrentCheckIns,
);
