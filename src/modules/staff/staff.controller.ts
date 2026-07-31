import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as reviewerApplicationService from "../reviewer-applications/reviewer-application.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.UserId;

  if (!userId) {
    throw new AppError(401, "Không xác định được người dùng");
  }

  return userId;
};

export const getReviewerApplicationsForStaff = asyncHandler(
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
      message: "Lấy danh sách đơn đăng ký Reviewer thành công",
      data: result,
    });
  },
);

export const acceptReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.reviewReviewerApplication(
        req.body.applicationId,
        getUserId(req),
        {
          status: "Accepted",
        },
      );

    return sendSuccess(res, {
      message: "Chấp thuận Reviewer thành công",
      data: application,
    });
  },
);

export const rejectReviewerApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application =
      await reviewerApplicationService.reviewReviewerApplication(
        req.body.applicationId,
        getUserId(req),
        {
          status: "Rejected",
          rejectionReason: req.body.reason,
        },
      );

    return sendSuccess(res, {
      message: "Từ chối Reviewer thành công",
      data: application,
    });
  },
);
