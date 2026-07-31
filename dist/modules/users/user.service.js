import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
const mapUserProfile = (user) => {
    return {
        id: user.id,
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        name: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        customerId: user.customer?.id ?? null,
        merchantId: user.merchant?.id ?? null,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};
export const getProfile = async (userId) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            customer: true,
            merchant: true,
        },
    });
    if (!user) {
        throw new AppError(404, "Không tìm thấy tài khoản");
    }
    return mapUserProfile(user);
};
export const updateProfile = async (userId, input) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });
    if (!existingUser) {
        throw new AppError(404, "Không tìm thấy tài khoản");
    }
    const user = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            fullName: input.fullName !== undefined ? input.fullName.trim() : undefined,
            phoneNumber: input.phoneNumber !== undefined
                ? input.phoneNumber?.trim() || null
                : undefined,
            avatarUrl: input.avatarUrl !== undefined
                ? input.avatarUrl?.trim() || null
                : undefined,
        },
        include: {
            customer: true,
            merchant: true,
        },
    });
    return mapUserProfile(user);
};
