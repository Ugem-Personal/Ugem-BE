import { z } from "zod";
const dateStringSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
    .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return false;
    }
    return date.toISOString().slice(0, 10) === value;
}, {
    message: "Ngày không hợp lệ",
});
export const staffRevenueSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantRevenueSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantTopFoodsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const merchantRecentOrdersSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const customerRecentOrdersSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const reviewerRecentEarningsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const staffRecentOrdersSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
export const staffTopMerchantsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const staffTopReviewersSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
});
export const staffTopFoodsSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
export const customerSpendingSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const reviewerEarningsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const staffUserGrowthSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const staffOrderGrowthSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantOrderGrowthSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerOrderGrowthSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const reviewerAffiliateGrowthSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantCampaignPerformanceSchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});
export const staffPaymentStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantPaymentStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerPaymentStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantCustomerStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});
export const merchantPeakHoursSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantWeekdayStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerFavoriteMerchantsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
        limit: z.coerce.number().int().min(1).max(20).default(5),
    }),
});
export const staffPeakHoursSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const staffWeekdayStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerWeekdayStatisticsSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerPeakHoursSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const merchantOrderPerformanceSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const staffOrderPerformanceSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const customerOrderPerformanceSchema = z.object({
    query: z.object({
        year: z.coerce
            .number()
            .int()
            .min(2000)
            .max(2100)
            .default(new Date().getFullYear()),
    }),
});
export const staffDailyRevenueSchema = z.object({
    query: z
        .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
    })
        .refine((data) => new Date(`${data.startDate}T00:00:00.000Z`).getTime() <=
        new Date(`${data.endDate}T00:00:00.000Z`).getTime(), {
        message: "startDate phải nhỏ hơn hoặc bằng endDate",
        path: ["endDate"],
    })
        .refine((data) => {
        const start = new Date(`${data.startDate}T00:00:00.000Z`);
        const end = new Date(`${data.endDate}T00:00:00.000Z`);
        const differenceInDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
        return differenceInDays <= 366;
    }, {
        message: "Khoảng thời gian thống kê không được vượt quá 366 ngày",
        path: ["endDate"],
    }),
});
export const merchantDailyRevenueSchema = z.object({
    query: z
        .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
    })
        .refine((data) => new Date(`${data.startDate}T00:00:00.000Z`).getTime() <=
        new Date(`${data.endDate}T00:00:00.000Z`).getTime(), {
        message: "startDate phải nhỏ hơn hoặc bằng endDate",
        path: ["endDate"],
    })
        .refine((data) => {
        const start = new Date(`${data.startDate}T00:00:00.000Z`);
        const end = new Date(`${data.endDate}T00:00:00.000Z`);
        const difference = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
        return difference <= 366;
    }, {
        message: "Khoảng thời gian thống kê không được vượt quá 366 ngày",
        path: ["endDate"],
    }),
});
export const customerDailySpendingSchema = z.object({
    query: z
        .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
    })
        .refine((data) => new Date(`${data.startDate}T00:00:00.000Z`).getTime() <=
        new Date(`${data.endDate}T00:00:00.000Z`).getTime(), {
        message: "startDate phải nhỏ hơn hoặc bằng endDate",
        path: ["endDate"],
    })
        .refine((data) => {
        const start = new Date(`${data.startDate}T00:00:00.000Z`);
        const end = new Date(`${data.endDate}T00:00:00.000Z`);
        const differenceInDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
        return differenceInDays <= 366;
    }, {
        message: "Khoảng thời gian thống kê không được vượt quá 366 ngày",
        path: ["endDate"],
    }),
});
