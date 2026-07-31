import { z } from "zod";
export const createAffiliateLinkSchema = z.object({
    body: z.object({
        merchantId: z.string().uuid("Merchant ID không hợp lệ"),
    }),
});
export const affiliateLinkIdSchema = z.object({
    params: z.object({
        id: z.string().uuid("Affiliate Link ID không hợp lệ"),
    }),
});
export const affiliateCodeSchema = z.object({
    params: z.object({
        code: z.string().trim().min(4, "Affiliate code không hợp lệ").max(100),
    }),
});
export const updateAffiliateLinkStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("Affiliate Link ID không hợp lệ"),
    }),
    body: z.object({
        isActive: z.boolean(),
    }),
});
export const affiliateEarningsSchema = z.object({
    query: z.object({
        pageIndex: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
    }),
});
