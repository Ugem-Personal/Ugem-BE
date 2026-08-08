import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { UserRole } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { generateAccessToken, generateRefreshToken, } from "../../common/utils/jwt.js";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { sendPasswordResetCode } from "../../common/services/email.service.js";
const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;
const PASSWORD_RESET_EXPIRES_IN_MINUTES = 10;
const PASSWORD_RESET_CODE_LENGTH = 6;
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const hashRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};
const getRefreshTokenExpiresAt = () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return expiresAt;
};
const createJwtPayload = (user) => {
    return {
        UserId: user.id,
        Email: user.email,
        Name: user.fullName,
        Role: user.role,
        CustomerId: user.customer?.id ?? null,
        MerchantId: user.merchant?.id ?? null,
        AvatarUrl: user.avatarUrl,
    };
};
const createTokenResult = (payload) => {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const refreshTokenExpiresAtUtc = getRefreshTokenExpiresAt();
    return {
        accessToken,
        refreshToken,
        refreshTokenExpiresAtUtc,
    };
};
const createAndStoreTokens = async (payload) => {
    const result = createTokenResult(payload);
    await prisma.refreshToken.create({
        data: {
            userId: payload.UserId,
            tokenHash: hashRefreshToken(result.refreshToken),
            expiresAt: result.refreshTokenExpiresAtUtc,
        },
    });
    return result;
};
export const register = async (input) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
    });
    if (existingUser) {
        throw new AppError(409, "Email đã được sử dụng");
    }
    if (input.phoneNumber?.trim()) {
        const normalizedPhone = input.phoneNumber.trim();
        const existingPhone = await prisma.user.findFirst({
            where: {
                phoneNumber: normalizedPhone,
            },
        });
        if (existingPhone) {
            throw new AppError(409, "Số điện thoại này đã được đăng ký bởi một tài khoản khác");
        }
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const role = input.role === "Merchant" ? UserRole.Merchant : UserRole.Customer;
    const user = await prisma.user.create({
        data: {
            email: normalizedEmail,
            passwordHash,
            phoneNumber: input.phoneNumber?.trim() || null,
            fullName: input.fullName.trim(),
            avatarUrl: input.avatarUrl?.trim() || null,
            role,
            /*
             * Merchant chưa tạo Customer.
             * Customer sẽ có Customer record ngay khi đăng ký.
             */
            customer: role === UserRole.Customer
                ? {
                    create: {},
                }
                : undefined,
        },
        include: {
            customer: true,
            merchant: true,
        },
    });
    const payload = createJwtPayload(user);
    const tokens = await createAndStoreTokens(payload);
    return {
        user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            customerId: user.customer?.id ?? null,
            merchantId: user.merchant?.id ?? null,
            isActive: user.isActive,
            createdAt: user.createdAt,
        },
        ...tokens,
    };
};
export const login = async (input) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
        include: {
            customer: true,
            merchant: true,
        },
    });
    if (!user) {
        throw new AppError(401, "Email hoặc mật khẩu không chính xác");
    }
    if (!user.isActive) {
        throw new AppError(403, "Tài khoản đã bị khóa");
    }
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
        throw new AppError(401, "Email hoặc mật khẩu không chính xác");
    }
    const payload = createJwtPayload(user);
    const tokens = await createAndStoreTokens(payload);
    return {
        user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            customerId: user.customer?.id ?? null,
            merchantId: user.merchant?.id ?? null,
            isActive: user.isActive,
        },
        ...tokens,
    };
};
export const refreshAccessToken = async (input) => {
    const tokenHash = hashRefreshToken(input.refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
        where: {
            tokenHash,
        },
        include: {
            user: {
                include: {
                    customer: true,
                    merchant: true,
                },
            },
        },
    });
    if (!storedToken) {
        throw new AppError(401, "Refresh token không tồn tại");
    }
    if (storedToken.revokedAt) {
        throw new AppError(401, "Refresh token đã bị thu hồi");
    }
    if (storedToken.expiresAt < new Date()) {
        throw new AppError(401, "Refresh token đã hết hạn");
    }
    if (!storedToken.user.isActive) {
        throw new AppError(403, "Tài khoản đã bị khóa");
    }
    /*
     * Token rotation:
     * token cũ bị thu hồi và phát token mới.
     */
    const newPayload = createJwtPayload({
        ...storedToken.user,
        customer: storedToken.user.customer,
        merchant: storedToken.user.merchant,
    });
    const newTokens = createTokenResult(newPayload);
    await prisma.$transaction([
        /*
         * Thu hồi refresh token cũ.
         */
        prisma.refreshToken.update({
            where: {
                id: storedToken.id,
            },
            data: {
                revokedAt: new Date(),
            },
        }),
        /*
         * Lưu refresh token mới trong cùng transaction.
         */
        prisma.refreshToken.create({
            data: {
                userId: storedToken.user.id,
                tokenHash: hashRefreshToken(newTokens.refreshToken),
                expiresAt: newTokens.refreshTokenExpiresAtUtc,
            },
        }),
    ]);
    return newTokens;
};
export const revokeRefreshToken = async (refreshToken) => {
    await prisma.refreshToken.updateMany({
        where: {
            tokenHash: hashRefreshToken(refreshToken),
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });
};
export const googleLogin = async (input) => {
    let googlePayload;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: input.idToken,
            audience: env.GOOGLE_CLIENT_ID,
        });
        googlePayload = ticket.getPayload();
    }
    catch {
        throw new AppError(401, "Google ID token không hợp lệ");
    }
    if (!googlePayload) {
        throw new AppError(401, "Không lấy được thông tin tài khoản Google");
    }
    const googleEmail = googlePayload.email?.trim().toLowerCase();
    if (!googleEmail) {
        throw new AppError(400, "Tài khoản Google không cung cấp email");
    }
    if (!googlePayload.email_verified) {
        throw new AppError(401, "Email Google chưa được xác minh");
    }
    let isNewUser = false;
    let user = await prisma.user.findUnique({
        where: {
            email: googleEmail,
        },
        include: {
            customer: true,
            merchant: true,
        },
    });
    if (!user) {
        isNewUser = true;
        /*
         * User đăng nhập Google không sử dụng mật khẩu thông thường.
         * Vì schema hiện bắt buộc passwordHash nên tạo chuỗi ngẫu nhiên
         * đã được hash, người dùng không thể đăng nhập bằng chuỗi này.
         */
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);
        user = await prisma.user.create({
            data: {
                email: googleEmail,
                passwordHash,
                fullName: googlePayload.name?.trim() ||
                    googleEmail.split("@")[0] ||
                    "Google User",
                avatarUrl: googlePayload.picture ?? null,
                role: UserRole.Customer,
                customer: {
                    create: {},
                },
            },
            include: {
                customer: true,
                merchant: true,
            },
        });
    }
    if (!user.isActive) {
        throw new AppError(403, "Tài khoản đã bị khóa");
    }
    /*
     * Không tự đổi vai trò tài khoản đã tồn tại.
     * Google Login chỉ tạo Customer khi email chưa tồn tại.
     */
    const payload = createJwtPayload(user);
    const tokens = await createAndStoreTokens(payload);
    return {
        ...tokens,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isNewUser,
    };
};
export const forgotPassword = async (input) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
        },
    });
    /*
     * Luôn trả kết quả thành công, kể cả email không tồn tại.
     * Điều này tránh để người ngoài dò email đã đăng ký.
     */
    if (!user || !user.isActive) {
        return null;
    }
    const resetCode = generatePasswordResetCode();
    const tokenHash = hashPasswordResetToken(resetCode);
    const expiresAt = getPasswordResetExpiresAt();
    /*
     * Vô hiệu hóa các mã cũ chưa sử dụng.
     */
    await prisma.passwordResetToken.updateMany({
        where: {
            userId: user.id,
            usedAt: null,
        },
        data: {
            usedAt: new Date(),
        },
    });
    await prisma.passwordResetToken.create({
        data: {
            userId: user.id,
            tokenHash,
            expiresAt,
        },
    });
    try {
        await sendPasswordResetCode(user.email, user.fullName, resetCode);
    }
    catch (error) {
        /*
         * Xóa token nếu gửi email thất bại để tránh tạo mã
         * mà người dùng không thể nhận được.
         */
        await prisma.passwordResetToken.deleteMany({
            where: {
                userId: user.id,
                tokenHash,
                usedAt: null,
            },
        });
        console.error("Không thể gửi email đặt lại mật khẩu:", error);
        throw new AppError(500, "Không thể gửi email đặt lại mật khẩu");
    }
    return null;
};
const hashPasswordResetToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};
const generatePasswordResetCode = () => {
    const minimum = 10 ** (PASSWORD_RESET_CODE_LENGTH - 1);
    const maximum = 10 ** PASSWORD_RESET_CODE_LENGTH;
    return crypto.randomInt(minimum, maximum).toString();
};
const getPasswordResetExpiresAt = () => {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_EXPIRES_IN_MINUTES);
    return expiresAt;
};
export const resetPassword = async (input) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    const tokenHash = hashPasswordResetToken(input.token.trim());
    const user = await prisma.user.findUnique({
        where: {
            email: normalizedEmail,
        },
        select: {
            id: true,
            isActive: true,
        },
    });
    if (!user || !user.isActive) {
        throw new AppError(400, "Email hoặc mã xác nhận không hợp lệ");
    }
    const passwordResetToken = await prisma.passwordResetToken.findFirst({
        where: {
            userId: user.id,
            tokenHash,
            usedAt: null,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    if (!passwordResetToken) {
        throw new AppError(400, "Email hoặc mã xác nhận không hợp lệ");
    }
    if (passwordResetToken.expiresAt < new Date()) {
        await prisma.passwordResetToken.update({
            where: {
                id: passwordResetToken.id,
            },
            data: {
                usedAt: new Date(),
            },
        });
        throw new AppError(400, "Mã xác nhận đã hết hạn");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await prisma.$transaction([
        prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                passwordHash,
            },
        }),
        prisma.passwordResetToken.update({
            where: {
                id: passwordResetToken.id,
            },
            data: {
                usedAt: new Date(),
            },
        }),
        /*
         * Thu hồi toàn bộ refresh token sau khi đổi mật khẩu.
         */
        prisma.refreshToken.updateMany({
            where: {
                userId: user.id,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        }),
        /*
         * Vô hiệu hóa các mã reset còn lại.
         */
        prisma.passwordResetToken.updateMany({
            where: {
                userId: user.id,
                usedAt: null,
            },
            data: {
                usedAt: new Date(),
            },
        }),
    ]);
    return null;
};
