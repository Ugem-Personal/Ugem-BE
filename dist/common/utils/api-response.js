export const sendSuccess = (res, options) => {
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
export const sendError = (res, options) => {
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
