import { z } from "zod";

const merchantIdSchema = z.string().uuid("Merchant ID không hợp lệ");

export const merchantWishlistParamSchema = z.object({
  params: z.object({
    merchantId: merchantIdSchema,
  }),
});

export const addWishlistBodySchema = z.object({
  body: z.object({
    merchantId: merchantIdSchema,
  }),
});
