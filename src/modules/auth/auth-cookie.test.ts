import { describe, expect, it } from "vitest";
import type { Request } from "express";

import { getRefreshTokenCookie } from "./auth-cookie.js";

const requestWithCookie = (cookie?: string) =>
  ({ headers: { cookie } }) as Request;

describe("refresh token cookie", () => {
  it("reads the UGem refresh token among other cookies", () => {
    const request = requestWithCookie(
      "theme=dark; ugem_refresh_token=token%20value; locale=vi",
    );

    expect(getRefreshTokenCookie(request)).toBe("token value");
  });

  it("returns undefined when the cookie is missing", () => {
    expect(getRefreshTokenCookie(requestWithCookie("theme=dark"))).toBeUndefined();
    expect(getRefreshTokenCookie(requestWithCookie())).toBeUndefined();
  });
});
