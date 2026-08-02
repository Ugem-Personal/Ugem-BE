import { describe, expect, it } from "vitest";

import { redactLogValue } from "./logger.js";

describe("structured logger redaction", () => {
  it("redacts secrets recursively without removing useful context", () => {
    expect(
      redactLogValue({
        email: "admin@ugem.vn",
        password: "do-not-log",
        nested: {
          authorization: "Bearer token",
          orderId: "order-1",
        },
      }),
    ).toEqual({
      email: "admin@ugem.vn",
      password: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        orderId: "order-1",
      },
    });
  });

  it("serializes Error values into structured fields", () => {
    const result = redactLogValue(new Error("boom"));

    expect(result).toMatchObject({ name: "Error", message: "boom" });
  });
});
