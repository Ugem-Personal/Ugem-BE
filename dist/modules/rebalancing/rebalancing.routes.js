import { Router } from "express";
import { authenticate } from "../../common/middleware/auth.middleware.js";
import { authorizeRoles } from "../../common/middleware/role.middleware.js";
import { getRebalancingStatus, runRebalancingManual, } from "./rebalancing.controller.js";
export const rebalancingRouter = Router();
rebalancingRouter.get("/status", authenticate, authorizeRoles("Staff", "Admin"), getRebalancingStatus);
rebalancingRouter.post("/run", authenticate, authorizeRoles("Staff", "Admin"), runRebalancingManual);
