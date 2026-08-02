import type { Response } from "express";

interface SuccessResponseOptions<T> {
  statusCode?: number;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export const sendSuccess = <T>(
  res: Response,
  options: SuccessResponseOptions<T>,
) => {
  const { statusCode = 200, message = "Success", data, meta } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: meta ?? null,
    errors: null,
    traceId: res.locals.traceId ?? null,
    timestampUtc: new Date().toISOString(),
  });
};

interface ErrorResponseOptions {
  statusCode: number;
  message: string;
  errors?: unknown;
}

export const sendError = (res: Response, options: ErrorResponseOptions) => {
  return res.status(options.statusCode).json({
    success: false,
    message: options.message,
    data: null,
    meta: null,
    errors: options.errors ?? null,
    traceId: res.locals.traceId ?? null,
    timestampUtc: new Date().toISOString(),
  });
};
