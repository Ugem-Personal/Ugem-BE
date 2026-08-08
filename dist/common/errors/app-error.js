export class AppError extends Error {
    statusCode;
    errors;
    isAppError = true;
    constructor(statusCode, message, errors) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
