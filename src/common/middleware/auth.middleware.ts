import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return next(new AppError(401, "Bạn chưa cung cấp access token"));
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Access token không đúng định dạng Bearer"));
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = payload;

    return next();
  } catch {
    return next(new AppError(401, "Access token không hợp lệ hoặc đã hết hạn"));
  }
};

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    req.user = undefined;
    return next();
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Access token không đúng định dạng Bearer"));
  }

  try {
    const payload = verifyAccessToken(token);

    req.user = payload;

    return next();
  } catch {
    return next(new AppError(401, "Access token không hợp lệ hoặc đã hết hạn"));
  }
};

