import { env } from "../../config/env.js";
const REFRESH_TOKEN_COOKIE = "ugem_refresh_token";
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
        path: "/api/v1/auth",
    });
};
export const clearRefreshTokenCookie = (res) => {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/api/v1/auth",
    });
};
export const getRefreshTokenCookie = (req) => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return undefined;
    for (const entry of cookieHeader.split(";")) {
        const [rawName, ...rawValue] = entry.trim().split("=");
        if (rawName !== REFRESH_TOKEN_COOKIE)
            continue;
        const value = rawValue.join("=");
        return value ? decodeURIComponent(value) : undefined;
    }
    return undefined;
};
