import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as reviewerApplicationService from "./reviewer-application.service.js";
import { createAuditLog } from "../audit/audit.service.js";
import { getAuditActor } from "../audit/audit-context.js";

const getCustomerId = (req: Request): string => {
  if (!req.user?.CustomerId) {
    throw new AppError(403, "Tài khoản không có CustomerId");
  }

  return req.user.CustomerId;
};

const getUserId = (req: Request): string => {
  if (!req.user?.UserId) {
    throw new AppError(401, "Không xác định được người dùng");
  }

  return req.user.UserId;
};

const getRouteParam = (
  value: string | string[] | undefined,
  name: string,
): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length === 1) {
    const [singleValue] = value;

    if (typeof singleValue === "string") {
      return singleValue;
    }
  }

  throw new AppError(400, `Thiếu hoặc không hợp lệ tham số ${name}`);
};

export const createReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.createReviewerApplication(
        getCustomerId(req),
        req.body,
      );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Gửi đơn đăng ký Reviewer thành công",
      data: application,
    });
  },
);

export const getMyReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.getMyReviewerApplication(
        getCustomerId(req),
      );

    return sendSuccess(res, {
      message: "Lấy đơn đăng ký Reviewer thành công",
      data: application,
    });
  },
);

export const getReviewerApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await reviewerApplicationService.getReviewerApplications({
      status: req.query.status as
        | "Pending"
        | "Accepted"
        | "Rejected"
        | undefined,

      pageIndex: Number(req.query.pageIndex ?? 1),

      pageSize: Number(req.query.pageSize ?? 10),
    });

    return sendSuccess(res, {
      message: "Lấy danh sách đơn Reviewer thành công",
      data: result,
    });
  },
);

export const reviewReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.reviewReviewerApplication(
        getRouteParam(req.params.id, "id"),
        getUserId(req),
        req.body,
      );

    await createAuditLog({
      actor: getAuditActor(req),
      action:
        req.body.status === "Accepted"
          ? "REVIEWER_APPLICATION_ACCEPTED"
          : "REVIEWER_APPLICATION_REJECTED",
      entityType: "ReviewerApplication",
      entityId: application.id,
      metadata: {
        status: req.body.status,
        rejectionReason: req.body.rejectionReason || null,
      },
    });

    return sendSuccess(res, {
      message:
        req.body.status === "Accepted"
          ? "Chấp thuận Reviewer thành công"
          : "Từ chối Reviewer thành công",

      data: application,
    });
  },
);

export const updateReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.updateReviewerApplication(
        getCustomerId(req),
        req.body,
      );

    return sendSuccess(res, {
      message: "Cập nhật đơn đăng ký Reviewer thành công",
      data: application,
    });
  },
);
