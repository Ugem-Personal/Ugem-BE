import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as adminService from "./admin.service.js";
import { RevenuePeriodType } from "./admin.types.js";
import { createAuditLog, getAuditLogs } from "../audit/audit.service.js";
import { getAuditActor } from "../audit/audit-context.js";

const getRouteId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string") {
    throw new AppError(400, "Thiếu Staff ID");
  }

  return id;
};

const getMerchantIdParam = (req: Request): string => {
  const merchantId = req.params.merchantId;

  if (typeof merchantId !== "string") {
    throw new AppError(400, "Thiếu Merchant ID");
  }

  return merchantId;
};

export const getStaffList = asyncHandler(
  async (_req: Request, res: Response) => {
    const staffMembers = await adminService.getStaffList();

    return sendSuccess(res, {
      message: "Lấy danh sách Staff thành công",
      data: staffMembers,
    });
  },
);

export const getStaffById = asyncHandler(
  async (req: Request, res: Response) => {
    const staff = await adminService.getStaffById(getRouteId(req));

    return sendSuccess(res, {
      message: "Lấy thông tin Staff thành công",
      data: staff,
    });
  },
);

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await adminService.createStaff(req.body);

  await createAuditLog({
    actor: getAuditActor(req),
    action: "STAFF_CREATED",
    entityType: "User",
    entityId: staff.id,
    metadata: { email: staff.email, fullName: staff.fullName },
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Tạo tài khoản Staff thành công",
    data: staff,
  });
});

export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const staffId = getRouteId(req);
  await adminService.deactivateStaff(staffId);

  await createAuditLog({
    actor: getAuditActor(req),
    action: "STAFF_DEACTIVATED",
    entityType: "User",
    entityId: staffId,
  });

  return sendSuccess(res, {
    message: "Khóa tài khoản Staff thành công",
    data: null,
  });
});

export const getAdminDashboard = asyncHandler(
  async (_req: Request, res: Response) => {
    const dashboard = await adminService.getAdminDashboard();

    return sendSuccess(res, {
      message: "Lấy Dashboard Admin thành công",
      data: dashboard,
    });
  },
);

export const getAdminAuditLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getAuditLogs({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      entityType:
        typeof req.query.entityType === "string"
          ? req.query.entityType
          : undefined,
      pageIndex: Number(req.query.pageIndex),
      pageSize: Number(req.query.pageSize),
    });

    return sendSuccess(res, {
      message: "Lấy nhật ký hệ thống thành công",
      data: result,
    });
  },
);

export const getMerchantRevenues = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await adminService.getMerchantRevenues({
      searchTerm:
        typeof req.query.searchTerm === "string"
          ? req.query.searchTerm
          : undefined,

      pageIndex: Number(req.query.pageIndex),

      pageSize: Number(req.query.pageSize),
    });

    return sendSuccess(res, {
      message: "Lấy doanh thu Merchant thành công",
      data: result,
    });
  },
);

export const getMerchantRevenueDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await adminService.getMerchantRevenueDetail(
      getMerchantIdParam(req),
      String(req.query.periodType) as RevenuePeriodType,
    );

    return sendSuccess(res, {
      message: "Lấy chi tiết doanh thu Merchant thành công",
      data: result,
    });
  },
);
