import { z } from "zod";

const optionalUrl = z
  .union([z.string().trim().url("URL không hợp lệ"), z.literal(""), z.null()])
  .optional();

export const createReviewerApplicationSchema = z.object({
  body: z.object({
    motivation: z
      .string()
      .trim()
      .min(1, "Động lực không được để trống")
      .max(3000),

    experience: z
      .union([z.string().trim().max(3000), z.literal(""), z.null()])
      .optional(),

    facebookUrl: optionalUrl,
    instagramUrl: optionalUrl,
    tiktokUrl: optionalUrl,
    youtubeUrl: optionalUrl,
    otherSocialUrl: optionalUrl,
  }),
});

export const reviewerApplicationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Reviewer Application ID không hợp lệ"),
  }),
});

export const reviewerApplicationListSchema = z.object({
  query: z.object({
    status: z.enum(["Pending", "Accepted", "Rejected"]).optional(),

    pageIndex: z.coerce.number().int().min(1).default(1),

    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const reviewReviewerApplicationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Reviewer Application ID không hợp lệ"),
  }),

  body: z
    .object({
      status: z.enum(["Accepted", "Rejected"]),

      rejectionReason: z
        .union([z.string().trim().max(1000), z.literal(""), z.null()])
        .optional(),
    })
    .superRefine((body, context) => {
      if (body.status === "Rejected" && !body.rejectionReason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectionReason"],
          message: "Phải nhập lý do khi từ chối",
        });
      }
    }),
});

export const updateReviewerApplicationSchema = z.object({
  body: z
    .object({
      reviewerApplicationId: z
        .string()
        .uuid("Reviewer Application ID không hợp lệ"),

      motivation: z
        .string()
        .trim()
        .min(1, "Động lực không được để trống")
        .max(3000)
        .optional(),

      experience: z
        .union([z.string().trim().max(3000), z.literal(""), z.null()])
        .optional(),

      facebookUrl: optionalUrl,
      instagramUrl: optionalUrl,
      tiktokUrl: optionalUrl,
      youtubeUrl: optionalUrl,
      otherSocialUrl: optionalUrl,
    })
    .refine(
      (body) =>
        body.motivation !== undefined ||
        body.experience !== undefined ||
        body.facebookUrl !== undefined ||
        body.instagramUrl !== undefined ||
        body.tiktokUrl !== undefined ||
        body.youtubeUrl !== undefined ||
        body.otherSocialUrl !== undefined,
      {
        message: "Phải có ít nhất một trường cần cập nhật",
      },
    ),
});
