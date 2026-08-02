import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import type { UserRole } from "../../generated/prisma/client.js";
import type { AuditActor } from "./audit.types.js";

export const getAuditActor = (req: Request): AuditActor => {
  if (!req.user?.UserId || !req.user.Role) {
    throw new AppError(401, "Không xác định được người thực hiện");
  }

  return {
    userId: req.user.UserId,
    role: req.user.Role as UserRole,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  };
};
