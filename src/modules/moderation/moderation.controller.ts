import type { Request, Response } from "express";
import { UserRole } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as service from "./moderation.service.js";

const actor = (req: Request): service.AuditActor => {
  if (!req.user?.UserId || !req.user.Role)
    throw new AppError(401, "Bạn chưa đăng nhập");
  return { userId: req.user.UserId, role: req.user.Role as UserRole };
};
const id = (req: Request) =>
  typeof req.params.id === "string"
    ? req.params.id
    : (() => {
        throw new AppError(400, "Thiếu ID");
      })();
const ok = (res: Response, message: string, data: unknown) =>
  sendSuccess(res, { message, data });

export const createIncident = asyncHandler(async (req, res) =>
  ok(
    res,
    "Tạo báo cáo thành công",
    await service.createIncident(actor(req), req.body),
  ),
);
export const listMyIncidents = asyncHandler(async (req, res) =>
  ok(
    res,
    "Lấy báo cáo thành công",
    await service.listIncidents({ reporterUserId: req.user?.UserId }),
  ),
);
export const listIncidents = asyncHandler(async (req, res) =>
  ok(
    res,
    "Lấy danh sách Incident thành công",
    await service.listIncidents({
      status:
        typeof req.query.status === "string" ? req.query.status : undefined,
      merchantId:
        typeof req.query.merchantId === "string"
          ? req.query.merchantId
          : undefined,
    }),
  ),
);
export const reviewIncident = asyncHandler(async (req, res) =>
  ok(
    res,
    "Cập nhật Incident thành công",
    await service.reviewIncident(actor(req), id(req), req.body),
  ),
);
export const createClaim = asyncHandler(async (req, res) =>
  ok(
    res,
    "Tạo yêu cầu claim thành công",
    await service.createClaim(actor(req), req.body),
  ),
);
export const reviewClaim = asyncHandler(async (req, res) =>
  ok(
    res,
    "Cập nhật claim thành công",
    await service.reviewClaim(actor(req), id(req), req.body),
  ),
);
export const createRemovalRequest = asyncHandler(async (req, res) =>
  ok(
    res,
    "Tạo yêu cầu gỡ listing thành công",
    await service.createRemovalRequest(actor(req), req.body),
  ),
);
export const reviewRemoval = asyncHandler(async (req, res) =>
  ok(
    res,
    "Cập nhật yêu cầu gỡ thành công",
    await service.reviewRemoval(actor(req), id(req), req.body),
  ),
);
export const createSuggestion = asyncHandler(async (req, res) =>
  ok(
    res,
    "Tạo đề xuất nhà hàng thành công",
    await service.createSuggestion(actor(req), req.body),
  ),
);
export const reviewSuggestion = asyncHandler(async (req, res) =>
  ok(
    res,
    "Cập nhật đề xuất thành công",
    await service.reviewSuggestion(actor(req), id(req), req.body),
  ),
);
export const listModeration = (
  kind: "incidents" | "claims" | "removals" | "suggestions",
) =>
  asyncHandler(async (_req, res) =>
    ok(
      res,
      "Lấy moderation queue thành công",
      await service.listModeration(kind),
    ),
  );
export const getMerchantAnalytics = asyncHandler(async (req, res) => {
  const merchantId = req.user?.MerchantId;
  if (!merchantId) throw new AppError(403, "Tài khoản không có MerchantId");
  return ok(
    res,
    "Lấy acquisition analytics thành công",
    await service.getMerchantAnalytics(merchantId),
  );
});
export const createFunnelEvent = asyncHandler(async (req, res) => {
  const event = await service.createFunnelEvent({
    ...req.body,
    userId: req.user?.UserId ?? req.body.userId,
  });
  return ok(res, "Ghi nhận funnel event thành công", event);
});
export const getFunnelSummary = asyncHandler(async (_req, res) =>
  ok(res, "Lấy funnel summary thành công", await service.getFunnelSummary()),
);
export const listFeePolicies = asyncHandler(async (_req, res) =>
  ok(res, "Lấy fee policies thành công", await service.listFeePolicies()),
);
export const upsertFeePolicy = asyncHandler(async (req, res) =>
  ok(
    res,
    "Tạo fee policy thành công",
    await service.upsertFeePolicy(actor(req), req.body),
  ),
);
export const getFeePreview = asyncHandler(async (req, res) =>
  ok(
    res,
    "Lấy fee preview thành công",
    await service.getFeePreview(String(req.query.feeType)),
  ),
);
