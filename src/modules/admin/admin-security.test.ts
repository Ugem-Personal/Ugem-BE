import { describe, expect, it } from "vitest";

import { registerSchema } from "../auth/auth.schema.js";
import { auditLogListSchema } from "./admin.schema.js";

describe("admin security boundaries", () => {
  it("never accepts Admin or Staff through public registration", () => {
    const baseBody = {
      email: "owner@ugem.test",
      password: "StrongPassword123",
      fullName: "UGem Owner",
    };

    expect(
      registerSchema.safeParse({ body: { ...baseBody, role: "Admin" } }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ body: { ...baseBody, role: "Staff" } }).success,
    ).toBe(false);
  });

  it("applies safe pagination defaults to audit logs", () => {
    const result = auditLogListSchema.parse({ query: {} });

    expect(result.query.pageIndex).toBe(1);
    expect(result.query.pageSize).toBe(20);
  });

  it("caps audit log page size", () => {
    expect(
      auditLogListSchema.safeParse({ query: { pageSize: 101 } }).success,
    ).toBe(false);
  });
});
