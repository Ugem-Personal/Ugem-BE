import { z } from "zod";
export const yearSchema = z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(new Date().getFullYear());
export const createLimitSchema = (defaultValue, maximum) => z.coerce.number().int().min(1).max(maximum).default(defaultValue);
export const dateStringSchema = z
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
export const createYearQuerySchema = () => z.object({
    query: z.object({
        year: yearSchema,
    }),
});
export const createLimitQuerySchema = (defaultValue, maximum) => z.object({
    query: z.object({
        limit: createLimitSchema(defaultValue, maximum),
    }),
});
export const createDateRangeQuerySchema = () => z.object({
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
        const startDate = new Date(`${data.startDate}T00:00:00.000Z`);
        const endDate = new Date(`${data.endDate}T00:00:00.000Z`);
        const differenceInDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
        return differenceInDays <= 366;
    }, {
        message: "Khoảng thời gian thống kê không được vượt quá 366 ngày",
        path: ["endDate"],
    }),
});
