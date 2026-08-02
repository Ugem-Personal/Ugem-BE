type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const sensitiveKeyPattern =
  /password|secret|token|authorization|cookie|api[-_]?key|credential/i;

export const redactLogValue = (
  value: unknown,
  depth = 0,
): unknown => {
  if (depth > 5) return "[MAX_DEPTH]";

  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) return value.toISOString();

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
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : redactLogValue(childValue, depth + 1),
      ]),
    );
  }

  return value;
};

const writeLog = (level: LogLevel, message: string, fields?: LogFields) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(fields ? (redactLogValue(fields) as LogFields) : {}),
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
  debug: (message: string, fields?: LogFields) =>
    writeLog("debug", message, fields),
  info: (message: string, fields?: LogFields) =>
    writeLog("info", message, fields),
  warn: (message: string, fields?: LogFields) =>
    writeLog("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    writeLog("error", message, fields),
};
