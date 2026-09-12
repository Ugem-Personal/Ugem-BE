import { z } from "zod";

const orderIdSchema = z.string().uuid("Order ID không hợp lệ");

export const generateCheckInQrSchema = z.object({
  query: z.object({
    orderId: orderIdSchema,
  }),
});

export const verifyCheckInSchema = z.object({
  body: z.object({
    orderId: orderIdSchema,
    checkInToken: z.string().min(32).max(500),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export const merchantVerifyCustomerCodeSchema = z.object({
  body: z.object({
    customerCode: z.string().trim().min(4, "Mã khách hàng phải từ 4 ký tự trở lên").max(50),
    rewardBenefit: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
});

