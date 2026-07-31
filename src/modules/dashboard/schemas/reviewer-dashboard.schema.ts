import {
  createLimitQuerySchema,
  createYearQuerySchema,
} from "./common-dashboard.schema.js";

export const reviewerRecentEarningsSchema = createLimitQuerySchema(5, 50);

export const reviewerEarningsSchema = createYearQuerySchema();

export const reviewerAffiliateGrowthSchema = createYearQuerySchema();
