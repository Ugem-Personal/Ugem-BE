import { z } from "zod";

export const cashOrderIdSchema = z.object({
  params: z.object({
    orderId: z.string().uuid("Order ID không hợp lệ"),
  }),
});

export const getBillSchema = z.object({
  query: z.object({
    orderId: z.string().uuid("Order ID không hợp lệ").optional(),
  }),
});

export const submitBillSchema = z.object({
  body: z.object({
    orderId: z.string().uuid("Order ID không hợp lệ"),

    amount: z.coerce.number().positive("Số tiền phải lớn hơn 0").optional(),

    discount: z.coerce.number().min(0, "Giảm giá không được âm").optional(),

    items: z
      .array(
        z.object({
          foodId: z.string().uuid("Food ID không hợp lệ"),

          quantity: z.coerce.number().int().min(1).max(100).optional(),

          unitPrice: z.coerce.number().positive().optional(),
        }),
      )
      .min(1)
      .max(100)
      .optional(),

    evidenceUrl: z
      .union([
        z.string().trim().url("Evidence URL không hợp lệ"),
        z.literal(""),
        z.null(),
      ])
      .optional(),

    transferContent: z
      .union([z.string().trim().max(300), z.literal(""), z.null()])
      .optional(),
  }),
});

export const confirmBillSchema = z.object({
  body: z
    .object({
      orderId: z.string().uuid("Order ID không hợp lệ").optional(),

      billId: z.string().uuid("Bill ID không hợp lệ").optional(),
    })
    .refine((body) => body.orderId || body.billId, {
      message: "Phải cung cấp orderId hoặc billId",
    }),
});

export const rejectBillSchema = z.object({
  body: z
    .object({
      orderId: z.string().uuid("Order ID không hợp lệ").optional(),

      billId: z.string().uuid("Bill ID không hợp lệ").optional(),

      rejectionReason: z.string().trim().max(1000).optional(),

      reason: z.string().trim().max(1000).optional(),
    })
    .superRefine((body, context) => {
      if (!body.orderId && !body.billId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["orderId"],
          message: "Phải cung cấp orderId hoặc billId",
        });
      }

      if (!body.rejectionReason?.trim() && !body.reason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Lý do từ chối không được để trống",
        });
      }
    })
    .transform((body) => ({
      orderId: body.orderId,
      billId: body.billId,

      rejectionReason:
        body.rejectionReason?.trim() ?? body.reason?.trim() ?? "",
    })),
});

export const sepayWebhookSchema = z.object({
  body: z
    .object({
      orderId: z.string().uuid().optional(),

      referenceCode: z.string().trim().optional(),

      content: z.string().trim().optional(),

      transferAmount: z.coerce.number().positive().optional(),

      amount: z.coerce.number().positive().optional(),
    })
    .passthrough(),
});
