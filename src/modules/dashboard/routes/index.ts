import { Router } from "express";

import { customerDashboardRouter } from "./customer-dashboard.routes.js";
import { merchantDashboardRouter } from "./merchant-dashboard.routes.js";
import { reviewerDashboardRouter } from "./reviewer-dashboard.routes.js";
import { staffDashboardRouter } from "./staff-dashboard.routes.js";

export const dashboardRouter = Router();

dashboardRouter.use("/merchant", merchantDashboardRouter);
dashboardRouter.use("/customer", customerDashboardRouter);
dashboardRouter.use("/reviewer", reviewerDashboardRouter);
dashboardRouter.use("/staff", staffDashboardRouter);
