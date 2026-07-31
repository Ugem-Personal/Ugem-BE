import { z } from "zod";
import { createDateRangeQuerySchema, createLimitQuerySchema, createLimitSchema, createYearQuerySchema, yearSchema, } from "./common-dashboard.schema.js";
export const customerRecentOrdersSchema = createLimitQuerySchema(5, 50);
export const customerSpendingSchema = createYearQuerySchema();
export const customerOrderGrowthSchema = createYearQuerySchema();
export const customerPaymentStatisticsSchema = createYearQuerySchema();
export const customerFavoriteMerchantsSchema = z.object({
    query: z.object({
        year: yearSchema,
        limit: createLimitSchema(5, 20),
    }),
});
export const customerWeekdayStatisticsSchema = createYearQuerySchema();
export const customerPeakHoursSchema = createYearQuerySchema();
export const customerOrderPerformanceSchema = createYearQuerySchema();
export const customerDailySpendingSchema = createDateRangeQuerySchema();
