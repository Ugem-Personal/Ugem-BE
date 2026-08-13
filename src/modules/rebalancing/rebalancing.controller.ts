import type { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import * as rebalancingService from "./rebalancing.service.js";

export const getRebalancingStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = await rebalancingService.getRebalancingStatus();
    return sendSuccess(res, {
      message: "Lấy trạng thái Rebalancing thành công",
      data: status,
    });
  },
);

export const runRebalancingManual = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await rebalancingService.runRebalancing();
    return sendSuccess(res, {
      message: "Thực thi Rebalancing hoàn tất",
      data: result,
    });
  },
);
