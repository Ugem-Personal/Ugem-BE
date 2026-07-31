import crypto from "node:crypto";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./common/middleware/error.middleware.js";
import { apiRateLimiter } from "./common/middleware/rate-limit.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { applicationRouter } from "./modules/applications/application.routes.js";
import { merchantRouter } from "./modules/merchants/merchant.routes.js";
import { foodToppingRouter } from "./modules/food-toppings/food-topping.routes.js";
import { foodRouter } from "./modules/foods/food.routes.js";
import { categoryRouter } from "./modules/categories/category.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { reviewRouter } from "./modules/reviews/review.routes.js";
import { wishlistRouter } from "./modules/wishlists/wishlist.routes.js";
import { reviewerApplicationRouter } from "./modules/reviewer-applications/reviewer-application.routes.js";
import { affiliateLinkRouter } from "./modules/affiliate-links/affiliate-link.routes.js";
import { campaignRouter } from "./modules/campaigns/campaign.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { dashboardRouter } from "./modules/dashboard/routes/index.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { checkInRouter } from "./modules/check-in/check-in.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { staffRouter } from "./modules/staff/staff.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";

export const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use((_req, res, next) => {
  res.locals.traceId = crypto.randomUUID();
  next();
});

app.use("/api", apiRateLimiter);

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "UGem API is running",
    data: {
      status: "UP",
    },
    errors: null,
    traceId: res.locals.traceId,
    timestampUtc: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/v1/applications", applicationRouter);
app.use("/api/v1/staff", staffRouter);
app.use("/api/v1/merchants", merchantRouter);
app.use("/api/v1/categories", categoryRouter);

app.use("/api/v1/foods", foodRouter);

app.use("/api/v1/food-toppings", foodToppingRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/check-in", checkInRouter);
app.use("/api/v1/wishlists", wishlistRouter);

app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/reviewer-application", reviewerApplicationRouter);
app.use("/api/v1/affiliate-links", affiliateLinkRouter);
app.use("/api/v1/campaigns", campaignRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/media", mediaRouter);
app.use(notFoundHandler);
app.use(errorHandler);
