import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as applicationService from "./application.service.js";

const getCurrentUser = (req: Request) => {
  if (!req.user?.UserId) {
    throw new AppError(401, "Không xác định được người dùng");
  }

  return {
    userId: req.user.UserId,
    role: req.user.Role,
  };
};

const getRouteId = (req: Request) => {
  const { id } = req.params;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError(400, "Missing route id");
  }

  return id;
};

export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUser = getCurrentUser(req);

    const application = await applicationService.createApplication(
      currentUser.userId,
      req.body,
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Gửi hồ sơ Merchant thành công",
      data: application,
    });
  },
);

export const getMyApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUser = getCurrentUser(req);

    const applications = await applicationService.getMyApplications(
      currentUser.userId,
    );

    return sendSuccess(res, {
      message: "Lấy danh sách hồ sơ thành công",
      data: applications,
    });
  },
);

export const getApplicationById = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUser = getCurrentUser(req);
    const applicationId = getRouteId(req);

    const application = await applicationService.getApplicationById(
      applicationId,
      currentUser,
    );

    return sendSuccess(res, {
      message: "Lấy thông tin hồ sơ thành công",
      data: application,
    });
  },
);

export const updateApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUser = getCurrentUser(req);
    const applicationId = getRouteId(req);

    const application = await applicationService.updateApplication(
      applicationId,
      currentUser.userId,
      req.body,
    );

    return sendSuccess(res, {
      message: "Cập nhật và gửi lại hồ sơ thành công",
      data: application,
    });
  },
);

export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await applicationService.getApplications({
      status: req.query.status as
        | "Draft"
        | "Pending"
        | "Accepted"
        | "Rejected"
        | undefined,

      search:
        typeof req.query.search === "string" ? req.query.search : undefined,

      pageIndex: Number(req.query.pageIndex ?? 1),

      pageSize: Number(req.query.pageSize ?? 10),
    });

    return sendSuccess(res, {
      message: "Lấy danh sách hồ sơ thành công",

      /*
       * FE hiện tại đọc data như Application[].
       */
      data: result.items,
    });
  },
);

export const reviewApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUser = getCurrentUser(req);
    const applicationId = getRouteId(req);

    const application = await applicationService.reviewApplication(
      applicationId,
      currentUser.userId,
      req.body,
    );

    return sendSuccess(res, {
      message:
        req.body.status === "Accepted"
          ? "Chấp thuận hồ sơ thành công"
          : "Từ chối hồ sơ thành công",

      data: application,
    });
  },
);
