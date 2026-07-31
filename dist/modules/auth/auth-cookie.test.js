import { describe, expect, it } from "vitest";
import { getRefreshTokenCookie } from "./auth-cookie.js";
const requestWithCookie = (cookie) => ({ headers: { cookie } });
describe("refresh token cookie", () => {
    it("reads the UGem refresh token among other cookies", () => {
        const request = requestWithCookie("theme=dark; ugem_refresh_token=token%20value; locale=vi");
        expect(getRefreshTokenCookie(request)).toBe("token value");
    });
    it("returns undefined when the cookie is missing", () => {
        expect(getRefreshTokenCookie(requestWithCookie("theme=dark"))).toBeUndefined();
        expect(getRefreshTokenCookie(requestWithCookie())).toBeUndefined();
    });
});
