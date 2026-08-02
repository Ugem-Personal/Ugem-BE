const sensitiveKeyPattern = /password|secret|token|authorization|cookie|api[-_]?key|credential/i;
export const redactLogValue = (value, depth = 0) => {
    if (depth > 5)
        return "[MAX_DEPTH]";
    if (typeof value === "bigint")
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactLogValue(item, depth + 1));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, childValue]) => [
            key,
            sensitiveKeyPattern.test(key)
                ? "[REDACTED]"
                : redactLogValue(childValue, depth + 1),
        ]));
    }
    return value;
};
const writeLog = (level, message, fields) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(fields ? redactLogValue(fields) : {}),
    };
    const serialized = JSON.stringify(entry);
    if (level === "error") {
        console.error(serialized);
        return;
    }
    if (level === "warn") {
        console.warn(serialized);
        return;
    }
    console.log(serialized);
};
export const logger = {
    debug: (message, fields) => writeLog("debug", message, fields),
    info: (message, fields) => writeLog("info", message, fields),
    warn: (message, fields) => writeLog("warn", message, fields),
    error: (message, fields) => writeLog("error", message, fields),
};
