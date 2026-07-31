import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";
import { env } from "../../config/env.js";

function secureEqual(received: string, expected: string) {
  const receivedHash = crypto.createHash("sha256").update(received).digest();

  const expectedHash = crypto.createHash("sha256").update(expected).digest();

  return crypto.timingSafeEqual(receivedHash, expectedHash);
}

export function authenticateSepayWebhook(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authorization = req.get("authorization") ?? "";
  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (
    scheme?.toLowerCase() !== "apikey" ||
    !token ||
    !secureEqual(token, env.SEPAY_WEBHOOK_API_KEY)
  ) {
    throw new AppError(401, "Webhook SePay không hợp lệ");
  }

  next();
}
