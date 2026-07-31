import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { requireApprovedMerchant } from "../../common/middleware/merchant.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";

import {
  acceptMerchantOrder,
  createMerchantOrder,
  createOrder,
  getMerchantOrders,
  getMyOrders,
  getOrderById,
  rejectMerchantOrder,
  updateOrderStatus,
  updateOrderStatusByRole,
} from "./order.controller.js";

import {
  createMerchantOrderSchema,
  createOrderSchema,
  orderIdParamSchema,
  orderIdSchema,
  orderListSchema,
  rejectMerchantOrderSchema,
  updateOrderStatusByRoleSchema,
  updateOrderStatusSchema,
} from "./order.schema.js";
import {
  confirmBill,
  confirmCashPayment,
  getCustomerBills,
  processSepayWebhook,
  rejectBill,
  requestCashConfirmation,
  submitBill,
} from "../payments/payment.controller.js";
import {
  cashOrderIdSchema,
  confirmBillSchema,
  getBillSchema,
  rejectBillSchema,
  sepayWebhookSchema,
  submitBillSchema,
} from "../payments/payment.schema.js";
import { authenticateSepayWebhook } from "../../common/middleware/sepay-webhook.middleware.js";
import { webhookRateLimiter } from "../../common/middleware/rate-limit.middleware.js";

export const orderRouter = Router();

orderRouter.post(
  "/sepay/webhook",
  webhookRateLimiter,
  authenticateSepayWebhook,
  validate(sepayWebhookSchema),
  processSepayWebhook,
);

orderRouter.use(authenticate);

orderRouter.get(
  "/",
  requireApprovedMerchant,
  validate(orderListSchema),
  getMerchantOrders,
);

orderRouter.post(
  "/",
  authorizeRoles("Customer", "Reviewer"),
  validate(createOrderSchema),
  createOrder,
);

orderRouter.get(
  "/mine",
  authorizeRoles("Customer", "Reviewer"),
  validate(orderListSchema),
  getMyOrders,
);

orderRouter.get(
  "/merchant",
  requireApprovedMerchant,
  validate(orderListSchema),
  getMerchantOrders,
);

orderRouter.get(
  "/bill",
  authorizeRoles("Customer", "Reviewer"),
  validate(getBillSchema),
  getCustomerBills,
);

orderRouter.patch(
  "/bill",
  requireApprovedMerchant,
  validate(submitBillSchema),
  submitBill,
);

orderRouter.post(
  "/bill/confirm",
  authorizeRoles("Customer", "Reviewer"),
  validate(confirmBillSchema),
  confirmBill,
);

orderRouter.post(
  "/bill/reject",
  authorizeRoles("Customer", "Reviewer"),
  validate(rejectBillSchema),
  rejectBill,
);

orderRouter.post(
  "/merchant",
  requireApprovedMerchant,
  validate(createMerchantOrderSchema),
  createMerchantOrder,
);

orderRouter.post(
  "/reject",
  requireApprovedMerchant,
  validate(rejectMerchantOrderSchema),
  rejectMerchantOrder,
);
orderRouter.post(
  "/:orderId/accept",
  requireApprovedMerchant,
  validate(orderIdParamSchema),
  acceptMerchantOrder,
);

orderRouter.patch(
  "/:id/status",
  authorizeRoles("Merchant", "Customer", "Reviewer"),
  validate(updateOrderStatusByRoleSchema),
  updateOrderStatusByRole,
);

orderRouter.patch(
  "/:orderId/cash/request",
  authorizeRoles("Customer", "Reviewer"),
  validate(cashOrderIdSchema),
  requestCashConfirmation,
);

orderRouter.patch(
  "/:orderId/cash/confirm",
  requireApprovedMerchant,
  validate(cashOrderIdSchema),
  confirmCashPayment,
);
orderRouter.get("/:id", validate(orderIdSchema), getOrderById);
