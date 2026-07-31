import type { NextFunction, Request, Response } from "express";

import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

export const validate = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next(
        new AppError(
          400,
          "Dữ liệu không hợp lệ",
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
    }

    const parsed = result.data as {
      body?: unknown;
      params?: Record<string, string>;
      query?: Record<string, unknown>;
    };

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }

    if (parsed.params) {
      Object.assign(req.params, parsed.params);
    }

    if (parsed.query) {
      Object.assign(req.query, parsed.query);
    }

    return next();
  };
};
