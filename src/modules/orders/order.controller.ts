import type { Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";

import * as orderService from "./order.service.js";

const getCustomerId = (req: Request): string => {
  const customerId = req.user?.CustomerId;

  if (!customerId) {
    throw new AppError(403, "Tài khoản không có CustomerId");
  }

  return customerId;
};

const getMerchantId = (req: Request): string => {
  const merchantId = req.user?.MerchantId;

  if (!merchantId) {
    throw new AppError(403, "Hồ sơ Merchant chưa được duyệt");
  }

  return merchantId;
};

const getParam = (req: Request, name: string): string => {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `Missing route parameter: ${name}`);
  }

  return value;
};

const getListQuery = (req: Request) => ({
  status: req.query.status as string | undefined,

  pageIndex: Number(req.query.pageIndex ?? 1),

  pageSize: Number(req.query.pageSize ?? 10),
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(getCustomerId(req), req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Tạo order thành công",
    data: order,
  });
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.getMyOrders(
    getCustomerId(req),
    getListQuery(req),
  );

  return sendSuccess(res, {
    message: "Lấy danh sách order thành công",
    data: result.items,
  });
});

export const createMerchantOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const customerId = req.body.customerId;

    if (typeof customerId !== "string") {
      throw new AppError(400, "Thiếu customerId");
    }

    const order = await orderService.createMerchantOrder(
      getMerchantId(req),
      customerId,
      req.body,
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Merchant tạo order thành công",
      data: order,
    });
  },
);

export const getMerchantOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await orderService.getMerchantOrders(
      getMerchantId(req),
      getListQuery(req),
    );

    return sendSuccess(res, {
      message: "Lấy danh sách order Merchant thành công",
      data: result.items,
    });
  },
);

export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await orderService.getOrderById(getParam(req, "id"), {
      customerId: req.user?.CustomerId ?? undefined,

      merchantId: req.user?.MerchantId ?? undefined,

      role: req.user?.Role ?? "",
    });

    return sendSuccess(res, {
      message: "Lấy thông tin order thành công",
      data: order,
    });
  },
);

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await orderService.updateOrderStatus(
      getMerchantId(req),
      getParam(req, "id"),
      req.body,
    );

    return sendSuccess(res, {
      message: "Cập nhật trạng thái order thành công",
      data: order,
    });
  },
);

export const updateCustomerOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await orderService.updateCustomerOrderStatus(
      getCustomerId(req),
      getParam(req, "id"),
      req.body,
    );

    return sendSuccess(res, {
      message: "Customer cập nhật trạng thái order thành công",
      data: order,
    });
  },
);

export const acceptMerchantOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await orderService.updateOrderStatus(
      getMerchantId(req),
      getParam(req, "orderId"),
      {
        status: "Accepted",
      },
    );

    return sendSuccess(res, {
      message: "Chấp nhận order thành công",
      data: order,
    });
  },
);

export const rejectMerchantOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await orderService.updateOrderStatus(
      getMerchantId(req),
      req.body.orderId,
      {
        status: "Rejected",
        rejectionReason: req.body.rejectionReason ?? req.body.reason,
      },
    );

    return sendSuccess(res, {
      message: "Từ chối order thành công",
      data: order,
    });
  },
);

export const updateOrderStatusByRole = asyncHandler(
  async (req: Request, res: Response) => {
    const role = req.user?.Role;
    const orderId = getParam(req, "id");

    if (role === "Merchant") {
      const order = await orderService.updateOrderStatus(
        getMerchantId(req),
        orderId,
        req.body,
      );

      return sendSuccess(res, {
        message: "Merchant cập nhật trạng thái order thành công",
        data: order,
      });
    }

    if (role === "Customer" || role === "Reviewer") {
      const order = await orderService.updateCustomerOrderStatus(
        getCustomerId(req),
        orderId,
        req.body,
      );

      return sendSuccess(res, {
        message: "Customer cập nhật trạng thái order thành công",
        data: order,
      });
    }

    throw new AppError(403, "Bạn không có quyền cập nhật trạng thái order");
  },
);
