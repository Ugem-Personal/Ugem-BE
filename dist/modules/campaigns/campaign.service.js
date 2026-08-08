import { CampaignDiscountType, MerchantStatus, NotificationType, Prisma, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { randomUUID } from "node:crypto";
import { createNotifications } from "../notifications/notification.service.js";
const campaignInclude = {
    merchant: {
        select: {
            id: true,
            name: true,
            logoUrl: true,
        },
    },
};
const notifyWishlistedCustomers = async (merchantId, campaignName) => {
    const followers = await prisma.wishlist.findMany({
        where: { merchantId },
        select: {
            customer: {
                select: {
                    userId: true,
                },
            },
        },
    });
    await createNotifications(followers.map((follower) => ({
        userId: follower.customer.userId,
        type: NotificationType.System,
        title: "Quán yêu thích có ưu đãi mới",
        message: `Campaign ${campaignName} vừa được mở. Hãy xem ưu đãi tại quán.`,
        referenceId: merchantId,
        referenceType: "Merchant",
    })));
};
const mapCampaign = (campaign) => {
    const discountValue = Number(campaign.discountValue);
    const minimumOrderAmount = Number(campaign.minimumOrderAmount);
    const maximumDiscount = campaign.maximumDiscount !== null ? Number(campaign.maximumDiscount) : null;
    return {
        id: campaign.id,
        campaignId: campaign.id,
        merchantId: campaign.merchantId,
        /*
         * Contract FE.
         */
        code: campaign.code,
        title: campaign.name,
        description: campaign.description,
        discountValue,
        isPercentage: campaign.discountType === CampaignDiscountType.Percentage,
        minOrderAmount: minimumOrderAmount,
        maxDiscountAmount: maximumDiscount,
        quantity: campaign.usageLimit ?? 0,
        usedCount: campaign.usedCount,
        /*
         * Database hiện chưa có hai field này.
         */
        maxUsagePerUser: campaign.maxUsagePerUser,
        isGlobal: campaign.isGlobal,
        isNewUserOnly: campaign.isNewUserOnly,
        isActive: campaign.isActive,
        startDate: campaign.startAt,
        endDate: campaign.endAt,
        /*
         * Giữ field BE cũ để không phá nơi khác.
         */
        name: campaign.name,
        discountType: campaign.discountType,
        minimumOrderAmount,
        maximumDiscount,
        usageLimit: campaign.usageLimit,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
        merchant: campaign.merchant,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
    };
};
export const createCampaign = async (merchantId, input) => {
    const merchant = await prisma.merchant.findFirst({
        where: {
            id: merchantId,
            status: MerchantStatus.Active,
        },
    });
    if (!merchant) {
        throw new AppError(404, "Không tìm thấy Merchant");
    }
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (endAt <= startAt) {
        throw new AppError(400, "Thời gian kết thúc phải sau thời gian bắt đầu");
    }
    const duplicate = await prisma.campaign.findFirst({
        where: {
            merchantId,
            name: {
                equals: input.name.trim(),
                mode: "insensitive",
            },
        },
    });
    if (duplicate) {
        throw new AppError(409, "Merchant đã có Campaign cùng tên");
    }
    const code = input.code?.trim().toUpperCase() ??
        `CMP-${randomUUID().slice(0, 8).toUpperCase()}`;
    if (await prisma.campaign.findUnique({ where: { code }, select: { id: true } })) {
        throw new AppError(409, "Mã Campaign đã tồn tại");
    }
    const campaign = await prisma.campaign.create({
        data: {
            merchantId,
            code,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            discountType: input.discountType,
            discountValue: new Prisma.Decimal(input.discountValue),
            minimumOrderAmount: new Prisma.Decimal(input.minimumOrderAmount ?? 0),
            maximumDiscount: input.maximumDiscount !== undefined && input.maximumDiscount !== null
                ? new Prisma.Decimal(input.maximumDiscount)
                : null,
            startAt,
            endAt,
            usageLimit: input.usageLimit === null ? null : (input.usageLimit ?? null),
            maxUsagePerUser: input.maxUsagePerUser ?? 1,
            isGlobal: input.isGlobal ?? false,
            isNewUserOnly: input.isNewUserOnly ?? false,
            isActive: input.isActive ?? true,
        },
        include: campaignInclude,
    });
    if (campaign.isActive) {
        await notifyWishlistedCustomers(merchantId, campaign.name);
    }
    return mapCampaign(campaign);
};
export const getMyCampaigns = async (merchantId) => {
    const campaigns = await prisma.campaign.findMany({
        where: {
            merchantId,
        },
        include: campaignInclude,
        orderBy: {
            createdAt: "desc",
        },
    });
    return campaigns.map(mapCampaign);
};
export const getActiveCampaignsByMerchant = async (merchantId) => {
    const currentTime = new Date();
    const campaigns = await prisma.campaign.findMany({
        where: {
            merchantId,
            isActive: true,
            startAt: {
                lte: currentTime,
            },
            endAt: {
                gte: currentTime,
            },
        },
        include: campaignInclude,
        orderBy: [
            {
                discountValue: "desc",
            },
            {
                createdAt: "desc",
            },
        ],
    });
    return campaigns
        .filter((campaign) => campaign.usageLimit === null ||
        campaign.usedCount < campaign.usageLimit)
        .map(mapCampaign);
};
export const getCampaignById = async (campaignId) => {
    const campaign = await prisma.campaign.findUnique({
        where: {
            id: campaignId,
        },
        include: campaignInclude,
    });
    if (!campaign) {
        throw new AppError(404, "Không tìm thấy Campaign");
    }
    return mapCampaign(campaign);
};
export const updateCampaign = async (merchantId, campaignId, input) => {
    const campaign = await prisma.campaign.findUnique({
        where: {
            id: campaignId,
        },
    });
    if (!campaign) {
        throw new AppError(404, "Không tìm thấy Campaign");
    }
    if (campaign.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền sửa Campaign này");
    }
    const startAt = input.startAt !== undefined ? new Date(input.startAt) : campaign.startAt;
    const endAt = input.endAt !== undefined ? new Date(input.endAt) : campaign.endAt;
    if (endAt <= startAt) {
        throw new AppError(400, "Thời gian kết thúc phải sau thời gian bắt đầu");
    }
    const discountType = input.discountType ?? campaign.discountType;
    const discountValue = input.discountValue ?? Number(campaign.discountValue);
    if (discountType === "Percentage" && discountValue > 100) {
        throw new AppError(400, "Giảm theo phần trăm không được vượt quá 100%");
    }
    const updated = await prisma.campaign.update({
        where: {
            id: campaignId,
        },
        data: {
            name: input.name?.trim(),
            code: input.code !== undefined ? input.code.trim().toUpperCase() : undefined,
            description: input.description !== undefined
                ? input.description?.trim() || null
                : undefined,
            discountType: input.discountType,
            discountValue: input.discountValue !== undefined
                ? new Prisma.Decimal(input.discountValue)
                : undefined,
            minimumOrderAmount: input.minimumOrderAmount !== undefined
                ? new Prisma.Decimal(input.minimumOrderAmount)
                : undefined,
            maximumDiscount: input.maximumDiscount !== undefined
                ? input.maximumDiscount === null
                    ? null
                    : new Prisma.Decimal(input.maximumDiscount)
                : undefined,
            startAt: input.startAt !== undefined ? startAt : undefined,
            endAt: input.endAt !== undefined ? endAt : undefined,
            usageLimit: input.usageLimit !== undefined ? input.usageLimit : undefined,
            maxUsagePerUser: input.maxUsagePerUser,
            isGlobal: input.isGlobal,
            isNewUserOnly: input.isNewUserOnly,
            isActive: input.isActive,
        },
        include: campaignInclude,
    });
    if (input.isActive === true && !campaign.isActive) {
        await notifyWishlistedCustomers(merchantId, updated.name);
    }
    return mapCampaign(updated);
};
export const updateCampaignStatus = async (merchantId, campaignId, isActive) => {
    const campaign = await prisma.campaign.findUnique({
        where: {
            id: campaignId,
        },
    });
    if (!campaign) {
        throw new AppError(404, "Không tìm thấy Campaign");
    }
    if (campaign.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền sửa Campaign này");
    }
    const updated = await prisma.campaign.update({
        where: {
            id: campaignId,
        },
        data: {
            isActive,
        },
        include: campaignInclude,
    });
    if (isActive && !campaign.isActive) {
        await notifyWishlistedCustomers(merchantId, updated.name);
    }
    return mapCampaign(updated);
};
export const deleteCampaign = async (merchantId, campaignId) => {
    const campaign = await prisma.campaign.findUnique({
        where: {
            id: campaignId,
        },
        include: {
            _count: {
                select: {
                    orders: true,
                },
            },
        },
    });
    if (!campaign) {
        throw new AppError(404, "Không tìm thấy Campaign");
    }
    if (campaign.merchantId !== merchantId) {
        throw new AppError(403, "Bạn không có quyền xóa Campaign này");
    }
    if (campaign._count.orders > 0) {
        const disabled = await prisma.campaign.update({
            where: {
                id: campaignId,
            },
            data: {
                isActive: false,
            },
            include: campaignInclude,
        });
        return mapCampaign(disabled);
    }
    await prisma.campaign.delete({
        where: {
            id: campaignId,
        },
    });
    return {
        campaignId,
    };
};
