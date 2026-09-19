import { z } from "zod";

import {
  createDateRangeQuerySchema,
  createLimitQuerySchema,
  createLimitSchema,
  createYearQuerySchema,
  yearSchema,
} from "./common-dashboard.schema.js";

export const merchantRevenueSchema = createYearQuerySchema();

export const merchantTopFoodsSchema = createLimitQuerySchema(5, 50);

export const merchantRecentOrdersSchema = createLimitQuerySchema(5, 50);

export const merchantOrderGrowthSchema = createYearQuerySchema();

export const merchantCampaignPerformanceSchema = createLimitQuerySchema(10, 50);

export const merchantAnalyticsSchema = z.object({
  query: z
    .object({
      from: z.string().datetime({ offset: true }).optional(),
      to: z.string().datetime({ offset: true }).optional(),
    })
    .refine(
      (query) =>
        !query.from || !query.to || new Date(query.from) <= new Date(query.to),
      {
        message: "from phải nhỏ hơn hoặc bằng to",
        path: ["to"],
      },
    ),
});

export const merchantPaymentStatisticsSchema = createYearQuerySchema();

export const merchantCustomerStatisticsSchema = z.object({
  query: z.object({
    year: yearSchema,
    limit: createLimitSchema(10, 50),
  }),
});

export const merchantPeakHoursSchema = createYearQuerySchema();

export const merchantWeekdayStatisticsSchema = createYearQuerySchema();

export const merchantOrderPerformanceSchema = createYearQuerySchema();

export const merchantDailyRevenueSchema = createDateRangeQuerySchema();
