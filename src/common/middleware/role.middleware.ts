import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error.js";

export type AppRole = "Customer" | "Reviewer" | "Merchant" | "Staff" | "Admin";

export const authorizeRoles = (...allowedRoles: AppRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Bạn chưa đăng nhập"));
    }

    const currentRole = req.user.Role as AppRole;

    /*
     * Reviewer được dùng các chức năng của Customer.
     */
    const normalizedAllowedRoles = allowedRoles.includes("Customer")
      ? [...allowedRoles, "Reviewer"]
      : allowedRoles;

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return next(
        new AppError(403, "Bạn không có quyền thực hiện chức năng này"),
      );
    }

    return next();
  };
};
