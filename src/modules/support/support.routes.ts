import { Router } from "express";

import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { validate } from "../../common/middleware/validate.middleware.js";
import {
  addMerchantMessage,
  addStaffMessage,
  assignStaff,
  createTicket,
  getMerchantTicket,
  getMerchantTickets,
  getStaffTicket,
  getStaffTickets,
  updateMerchantStatus,
  updateStaffStatus,
} from "./support.controller.js";
import {
  createSupportMessageSchema,
  createSupportTicketSchema,
  supportTicketIdSchema,
  supportTicketListSchema,
  updateSupportTicketStatusSchema,
} from "./support.schema.js";

export const merchantSupportRouter = Router();
merchantSupportRouter.use(authenticate, authorizeRoles("Merchant"));
merchantSupportRouter.get("/", validate(supportTicketListSchema), getMerchantTickets);
merchantSupportRouter.post("/", validate(createSupportTicketSchema), createTicket);
merchantSupportRouter.get("/:id", validate(supportTicketIdSchema), getMerchantTicket);
merchantSupportRouter.post("/:id/messages", validate(createSupportMessageSchema), addMerchantMessage);
merchantSupportRouter.patch("/:id/status", validate(updateSupportTicketStatusSchema), updateMerchantStatus);

export const staffSupportRouter = Router();
staffSupportRouter.use(authenticate, authorizeRoles("Staff", "Admin"));
staffSupportRouter.get("/", validate(supportTicketListSchema), getStaffTickets);
staffSupportRouter.get("/:id", validate(supportTicketIdSchema), getStaffTicket);
staffSupportRouter.post("/:id/assign", validate(supportTicketIdSchema), assignStaff);
staffSupportRouter.post("/:id/messages", validate(createSupportMessageSchema), addStaffMessage);
staffSupportRouter.patch("/:id/status", validate(updateSupportTicketStatusSchema), updateStaffStatus);
