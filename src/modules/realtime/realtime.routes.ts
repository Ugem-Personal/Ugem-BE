import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { getRealtimeStatus, handleRealtimeStream } from "./realtime.controller.js";

export const realtimeRouter = Router();

realtimeRouter.get("/stream", asyncHandler(handleRealtimeStream));
realtimeRouter.get("/status", asyncHandler(getRealtimeStatus));
