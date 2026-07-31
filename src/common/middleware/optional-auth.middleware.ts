import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/jwt.js";

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return next();
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next();
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    /*
     * Public endpoint:
     * token sai vẫn tiếp tục như khách chưa đăng nhập.
     */
  }

  return next();
};
