export const sendSuccess = (res, options) => {
    const { statusCode = 200, message = "Success", data } = options;
    return res.status(statusCode).json({
        success: true,
        message,
        data,
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
        errors: options.errors ?? null,
        traceId: res.locals.traceId ?? null,
        timestampUtc: new Date().toISOString(),
    });
};
