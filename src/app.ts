import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./common/middleware/error.middleware.js";
import { apiRateLimiter } from "./common/middleware/rate-limit.middleware.js";
import { requestObservability } from "./common/middleware/request-observability.middleware.js";
import {
  getLiveness,
  getReadiness,
} from "./modules/health/health.controller.js";
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
import { rebalancingRouter } from "./modules/rebalancing/rebalancing.routes.js";
import { bookingRouter } from "./modules/bookings/booking.routes.js";
import { merchantSupportRouter, staffSupportRouter } from "./modules/support/support.routes.js";

export const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", true);
}

app.use(requestObservability);
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.includes("localhost") || origin.includes("vercel.app") || origin === env.FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/health/live", getLiveness);
app.get("/api/v1/health/ready", getReadiness);
app.get("/api/v1/health", getReadiness);

app.use("/api", apiRateLimiter);

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
app.use("/api/v1/rebalancing", rebalancingRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/merchant/support", merchantSupportRouter);
app.use("/api/v1/staff/support", staffSupportRouter);
app.use(notFoundHandler);
app.use(errorHandler);
