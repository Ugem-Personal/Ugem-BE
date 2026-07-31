import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../common/errors/app-error.js";

import { applicationBodySchema } from "./application.schema.js";

import { parseApplicationFormData } from "./application.parser.js";

export const parseCreateApplication = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const parsedBody = parseApplicationFormData(req.body);

  const result = applicationBodySchema.safeParse(parsedBody);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(new AppError(400, "Dữ liệu hồ sơ không hợp lệ", errors));
  }

  req.body = result.data;

  return next();
};

export const validateJsonApplication = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const normalizedBody = {
    ...req.body,

    menu: req.body.menu ?? req.body.menus ?? [],
  };

  const result = applicationBodySchema.safeParse(normalizedBody);

  if (!result.success) {
    return next(
      new AppError(
        400,
        "Dữ liệu hồ sơ không hợp lệ",
        result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
  }

  req.body = result.data;

  return next();
};
