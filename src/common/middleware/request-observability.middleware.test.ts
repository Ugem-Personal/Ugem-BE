import { describe, expect, it } from "vitest";

import { resolveTraceId } from "./request-observability.middleware.js";

describe("request trace id", () => {
  it("keeps a safe caller-provided request id", () => {
    expect(resolveTraceId("checkout-request-123")).toBe(
      "checkout-request-123",
    );
  });

  it("replaces missing or unsafe request ids", () => {
    expect(resolveTraceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(resolveTraceId("bad request id\nforged")).not.toContain("\n");
  });
});
