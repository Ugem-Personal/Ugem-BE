import { Router, type NextFunction, type Request, type Response } from "express";

import { validate } from "../../common/middleware/validate.middleware.js";
import {
  authRateLimiter,
  passwordResetRateLimiter,
  refreshTokenRateLimiter,
  registrationRateLimiter,
} from "../../common/middleware/rate-limit.middleware.js";

import {
  forgotPassword,
  googleLogin,
  login,
  logout,
  refreshToken,
  register,
  resetPassword,
} from "./auth.controller.js";

import {
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schema.js";
import { getRefreshTokenCookie } from "./auth-cookie.js";

export const authRouter = Router();

const hydrateRefreshToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const refreshToken = getRefreshTokenCookie(req) ?? req.body?.refreshToken;

  req.body = {
    ...(req.body ?? {}),
    refreshToken,
  };

  next();
};

authRouter.post(
  "/register",
  registrationRateLimiter,
  validate(registerSchema),
  register,
);

authRouter.post("/login", authRateLimiter, validate(loginSchema), login);

authRouter.post(
  "/google-login",
  authRateLimiter,
  validate(googleLoginSchema),
  googleLogin,
);

authRouter.post(
  "/refresh-token",
  refreshTokenRateLimiter,
  hydrateRefreshToken,
  validate(refreshTokenSchema),
  refreshToken,
);

authRouter.post(
  "/logout",
  refreshTokenRateLimiter,
  hydrateRefreshToken,
  validate(refreshTokenSchema),
  logout,
);

authRouter.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

authRouter.post(
  "/reset-password",
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);
