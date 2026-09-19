import { IncidentSeverity, IncidentStatus, IncidentType, MerchantClaimStatus, MerchantListingVisibility, MerchantRemovalStatus, MerchantStatus, MerchantVerificationStatus, FunnelEventType, MonetizationFeeType, RestaurantSuggestionStatus, UserRole, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { getMerchantAnalytics as getAggregatedMerchantAnalytics } from "../../common/services/merchant-analytics.service.js";
const audit = async (actor, action, entityType, entityId, metadata) => {
    await prisma.auditLog.create({
        data: {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action,
            entityType,
            entityId,
            metadata,
        },
    });
};
const requireText = (value, field) => {
    if (typeof value !== "string" || value.trim().length === 0)
        throw new AppError(400, `${field} là bắt buộc`);
    return value.trim();
};
const enumValue = (value, allowed, field) => {
    if (typeof value !== "string" || !allowed.includes(value))
        throw new AppError(400, `${field} không hợp lệ`);
    return value;
};
const urls = (value) => Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .slice(0, 10)
    : [];
export const createIncident = async (actor, input) => {
    const merchantId = requireText(input.merchantId, "merchantId");
    const description = requireText(input.description, "description");
    const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true },
    });
    if (!merchant)
        throw new AppError(404, "Không tìm thấy Merchant");
    const incident = await prisma.merchantIncident.create({
        data: {
            merchantId,
            reporterUserId: actor.userId,
            type: enumValue(input.type, Object.values(IncidentType), "type"),
            severity: enumValue(input.severity ?? IncidentSeverity.Medium, Object.values(IncidentSeverity), "severity"),
            description,
            evidenceUrls: urls(input.evidenceUrls),
        },
    });
    await audit(actor, "MERCHANT_INCIDENT_CREATED", "MerchantIncident", incident.id, { merchantId, severity: incident.severity, type: incident.type });
    return incident;
};
export const listIncidents = async (filters) => prisma.merchantIncident.findMany({
    where: {
        status: filters.status,
        merchantId: filters.merchantId,
        reporterUserId: filters.reporterUserId,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
});
export const listMyClaims = (userId) => prisma.merchantClaim.findMany({
    where: { submittedByUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
});
export const listMyRemovalRequests = (userId) => prisma.merchantRemovalRequest.findMany({
    where: { submittedByUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
});
export const listMerchantIncidents = (merchantId) => prisma.merchantIncident.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 100,
});
export const reviewIncident = async (actor, incidentId, input) => {
    const incident = await prisma.merchantIncident.findUnique({
        where: { id: incidentId },
    });
    if (!incident)
        throw new AppError(404, "Không tìm thấy Incident");
    const status = enumValue(input.status, Object.values(IncidentStatus), "status");
    const severity = input.severity === undefined
        ? incident.severity
        : enumValue(input.severity, Object.values(IncidentSeverity), "severity");
    const shouldSuppress = severity === IncidentSeverity.High ||
        severity === IncidentSeverity.Critical;
    const updated = await prisma.$transaction(async (transaction) => {
        const next = await transaction.merchantIncident.update({
            where: { id: incidentId },
            data: {
                status,
                severity,
                adminDecision: typeof input.adminDecision === "string"
                    ? input.adminDecision.trim()
                    : null,
                resolution: typeof input.resolution === "string" ? input.resolution.trim() : null,
                reviewedByUserId: actor.userId,
                reviewedAt: new Date(),
            },
        });
        if (status === IncidentStatus.Resolved ||
            status === IncidentStatus.Rejected) {
            const activeRisk = await transaction.merchantIncident.count({
                where: {
                    merchantId: incident.merchantId,
                    status: { in: [IncidentStatus.Open, IncidentStatus.UnderReview] },
                    severity: { in: [IncidentSeverity.High, IncidentSeverity.Critical] },
                    id: { not: incidentId },
                },
            });
            if (activeRisk === 0)
                await transaction.merchant.update({
                    where: { id: incident.merchantId },
                    data: { safetySuppressed: false, safetyRiskScore: 0 },
                });
        }
        else if (shouldSuppress) {
            await transaction.merchant.update({
                where: { id: incident.merchantId },
                data: {
                    verificationStatus: MerchantVerificationStatus.UnderReview,
                    safetySuppressed: true,
                    safetyRiskScore: severity === IncidentSeverity.Critical ? 1 : 0.7,
                    listingVisibility: severity === IncidentSeverity.Critical
                        ? MerchantListingVisibility.Hidden
                        : undefined,
                },
            });
            if (severity === IncidentSeverity.Critical)
                await transaction.campaign.updateMany({
                    where: { merchantId: incident.merchantId, isActive: true },
                    data: { isActive: false },
                });
        }
        return next;
    });
    await audit(actor, "MERCHANT_INCIDENT_REVIEWED", "MerchantIncident", incidentId, { status, severity, merchantId: incident.merchantId });
    return updated;
};
export const createClaim = async (actor, input) => {
    const merchantId = requireText(input.merchantId, "merchantId");
    const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true },
    });
    if (!merchant)
        throw new AppError(404, "Không tìm thấy Merchant");
    const existing = await prisma.merchantClaim.findFirst({
        where: {
            merchantId,
            status: {
                in: [MerchantClaimStatus.Pending, MerchantClaimStatus.UnderReview],
            },
        },
    });
    if (existing)
        throw new AppError(409, "Merchant đã có claim đang được xử lý");
    const claim = await prisma.merchantClaim.create({
        data: {
            merchantId,
            submittedByUserId: actor.userId,
            evidenceUrls: urls(input.evidenceUrls),
        },
    });
    await audit(actor, "MERCHANT_CLAIM_CREATED", "MerchantClaim", claim.id, {
        merchantId,
    });
    return claim;
};
export const createRemovalRequest = async (actor, input) => {
    const merchantId = requireText(input.merchantId, "merchantId");
    const reason = requireText(input.reason, "reason");
    const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true },
    });
    if (!merchant)
        throw new AppError(404, "Không tìm thấy Merchant");
    const request = await prisma.merchantRemovalRequest.create({
        data: { merchantId, submittedByUserId: actor.userId, reason },
    });
    await audit(actor, "MERCHANT_REMOVAL_REQUESTED", "MerchantRemovalRequest", request.id, { merchantId });
    return request;
};
export const reviewClaim = async (actor, id, input) => {
    const claim = await prisma.merchantClaim.findUnique({ where: { id } });
    if (!claim)
        throw new AppError(404, "Không tìm thấy Claim");
    const status = enumValue(input.status, Object.values(MerchantClaimStatus), "status");
    const updated = await prisma.$transaction(async (transaction) => {
        const claimant = await transaction.user.findUnique({
            where: { id: claim.submittedByUserId },
            select: { id: true, role: true, merchant: { select: { id: true } } },
        });
        if (!claimant)
            throw new AppError(404, "KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n claim");
        if (claimant.merchant && claimant.merchant.id !== claim.merchantId)
            throw new AppError(409, "TÃ i khoáº£n Ä‘Ã£ liÃªn káº¿t vá»›i merchant khÃ¡c");
        const merchantBefore = await transaction.merchant.findUniqueOrThrow({
            where: { id: claim.merchantId }, select: { userId: true },
        });
        const result = await transaction.merchantClaim.update({
            where: { id },
            data: {
                status,
                decision: typeof input.decision === "string" ? input.decision.trim() : null,
                reviewedByUserId: actor.userId,
                reviewedAt: new Date(),
            },
        });
        if (status === MerchantClaimStatus.Approved)
            await transaction.merchant.update({
                where: { id: claim.merchantId },
                data: {
                    userId: claim.submittedByUserId,
                    verificationStatus: MerchantVerificationStatus.VerifiedBusiness,
                    listingVisibility: MerchantListingVisibility.Public,
                },
            });
        if (status === MerchantClaimStatus.Approved) {
            const previousOwner = await transaction.user.findUnique({
                where: { id: merchantBefore.userId },
                select: { id: true, role: true },
            });
            if (previousOwner && previousOwner.id !== claimant.id && previousOwner.role === UserRole.Merchant)
                await transaction.user.update({ where: { id: previousOwner.id }, data: { role: UserRole.Customer } });
        }
        if (status === MerchantClaimStatus.Approved && claimant.role !== UserRole.Merchant)
            await transaction.user.update({
                where: { id: claimant.id },
                data: { role: UserRole.Merchant },
            });
        return result;
    });
    await audit(actor, "MERCHANT_CLAIM_REVIEWED", "MerchantClaim", id, {
        status,
        merchantId: claim.merchantId,
        submittedByUserId: claim.submittedByUserId,
    });
    return updated;
};
export const reviewRemoval = async (actor, id, input) => {
    const request = await prisma.merchantRemovalRequest.findUnique({
        where: { id },
    });
    if (!request)
        throw new AppError(404, "Không tìm thấy Removal Request");
    const status = enumValue(input.status, Object.values(MerchantRemovalStatus), "status");
    const updated = await prisma.$transaction(async (transaction) => {
        const result = await transaction.merchantRemovalRequest.update({
            where: { id },
            data: {
                status,
                decision: typeof input.decision === "string" ? input.decision.trim() : null,
                reviewedByUserId: actor.userId,
                reviewedAt: new Date(),
            },
        });
        if (status === MerchantRemovalStatus.Approved) {
            await transaction.merchant.update({
                where: { id: request.merchantId },
                data: {
                    status: "Inactive",
                    verificationStatus: MerchantVerificationStatus.Removed,
                    listingVisibility: MerchantListingVisibility.Hidden,
                    safetySuppressed: true,
                },
            });
            await transaction.campaign.updateMany({
                where: { merchantId: request.merchantId, isActive: true },
                data: { isActive: false },
            });
        }
        return result;
    });
    await audit(actor, "MERCHANT_REMOVAL_REVIEWED", "MerchantRemovalRequest", id, { status, merchantId: request.merchantId });
    return updated;
};
export const createSuggestion = async (actor, input) => {
    const suggestion = await prisma.restaurantSuggestion.create({
        data: {
            name: requireText(input.name, "name"),
            address: requireText(input.address, "address"),
            category: typeof input.category === "string" ? input.category.trim() : null,
            recommendedDish: typeof input.recommendedDish === "string"
                ? input.recommendedDish.trim()
                : null,
            description: typeof input.description === "string" ? input.description.trim() : null,
            images: urls(input.images),
            reason: requireText(input.reason, "reason"),
            submittedByUserId: actor.userId,
        },
    });
    await audit(actor, "RESTAURANT_SUGGESTION_CREATED", "RestaurantSuggestion", suggestion.id);
    return suggestion;
};
export const reviewSuggestion = async (actor, id, input) => {
    const status = enumValue(input.status, Object.values(RestaurantSuggestionStatus), "status");
    const suggestion = await prisma.restaurantSuggestion
        .update({
        where: { id },
        data: { status, reviewedByUserId: actor.userId, reviewedAt: new Date() },
    })
        .catch(() => {
        throw new AppError(404, "Không tìm thấy Suggestion");
    });
    await audit(actor, "RESTAURANT_SUGGESTION_REVIEWED", "RestaurantSuggestion", id, { status });
    return suggestion;
};
export const getMerchantAnalytics = async (merchantId) => {
    return getAggregatedMerchantAnalytics(merchantId);
};
export const listModeration = async (kind) => {
    if (kind === "incidents")
        return prisma.merchantIncident.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
        });
    if (kind === "claims")
        return prisma.merchantClaim.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
        });
    if (kind === "removals")
        return prisma.merchantRemovalRequest.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
        });
    return prisma.restaurantSuggestion.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
    });
};
export const listModeratedMerchants = () => prisma.merchant.findMany({
    select: {
        id: true,
        name: true,
        address: true,
        status: true,
        verificationStatus: true,
        listingVisibility: true,
        safetySuppressed: true,
        safetyRiskScore: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
});
export const updateMerchantModeration = async (actor, merchantId, input) => {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant)
        throw new AppError(404, "KhÃ´ng tÃ¬m tháº¥y Merchant");
    const allowedStatus = Object.values(MerchantStatus);
    const allowedVerification = Object.values(MerchantVerificationStatus);
    const allowedVisibility = Object.values(MerchantListingVisibility);
    const data = {};
    if (input.status !== undefined)
        data.status = enumValue(input.status, allowedStatus, "status");
    if (input.verificationStatus !== undefined)
        data.verificationStatus = enumValue(input.verificationStatus, allowedVerification, "verificationStatus");
    if (input.listingVisibility !== undefined)
        data.listingVisibility = enumValue(input.listingVisibility, allowedVisibility, "listingVisibility");
    if (input.safetySuppressed !== undefined) {
        if (typeof input.safetySuppressed !== "boolean")
            throw new AppError(400, "safetySuppressed pháº£i lÃ  boolean");
        if (!input.safetySuppressed) {
            const activeRisks = await prisma.merchantIncident.count({
                where: {
                    merchantId,
                    status: { in: [IncidentStatus.Open, IncidentStatus.UnderReview] },
                    severity: { in: [IncidentSeverity.High, IncidentSeverity.Critical] },
                },
            });
            if (activeRisks > 0)
                throw new AppError(409, "Merchant cÃ²n incident High/Critical Ä‘ang xá»­ lÃ½");
            data.safetyRiskScore = 0;
        }
        data.safetySuppressed = input.safetySuppressed;
    }
    if (!Object.keys(data).length)
        throw new AppError(400, "KhÃ´ng cÃ³ thay Ä‘á»•i há»£p lá»‡");
    const updated = await prisma.$transaction(async (transaction) => {
        const next = await transaction.merchant.update({ where: { id: merchantId }, data });
        await transaction.auditLog.create({
            data: {
                actorUserId: actor.userId,
                actorRole: actor.role,
                action: "MERCHANT_MODERATION_UPDATED",
                entityType: "Merchant",
                entityId: merchantId,
                metadata: {
                    oldStatus: merchant.status,
                    oldVerificationStatus: merchant.verificationStatus,
                    oldListingVisibility: merchant.listingVisibility,
                    oldSafetySuppressed: merchant.safetySuppressed,
                    changes: input,
                },
            },
        });
        if (data.status === "Suspended" || data.listingVisibility === MerchantListingVisibility.Hidden)
            await transaction.campaign.updateMany({
                where: { merchantId, isActive: true },
                data: { isActive: false },
            });
        return next;
    });
    return updated;
};
export const listSuspiciousCheckIns = () => prisma.checkIn.findMany({
    where: { suspicious: true },
    include: {
        merchant: { select: { id: true, name: true } },
        customer: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        acquisitionEvent: { select: { id: true, status: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: 200,
});
export const createFunnelEvent = async (input) => {
    const eventType = enumValue(input.eventType, Object.values(FunnelEventType), "eventType");
    return prisma.funnelEvent.create({
        data: {
            eventType,
            userId: input.userId,
            merchantId: input.merchantId,
            sessionKey: input.sessionKey,
            metadata: input.metadata,
        },
    });
};
export const getFunnelSummary = async () => {
    const rows = await prisma.funnelEvent.groupBy({
        by: ["eventType"],
        _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.eventType, row._count._all]));
};
export const listFeePolicies = async () => prisma.monetizationFeePolicy.findMany({
    orderBy: [{ feeType: "asc" }, { effectiveAt: "desc" }],
});
export const upsertFeePolicy = async (actor, input) => {
    const feeType = enumValue(input.feeType, Object.values(MonetizationFeeType), "feeType");
    const amount = input.amount === null || input.amount === undefined || input.amount === ""
        ? null
        : Number(input.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0))
        throw new AppError(400, "amount không hợp lệ");
    const policy = await prisma.monetizationFeePolicy.create({
        data: {
            feeType,
            amount,
            currency: typeof input.currency === "string"
                ? input.currency.trim().toUpperCase()
                : "VND",
            isActive: input.isActive === true,
            metadata: input.metadata,
        },
    });
    await audit(actor, "MONETIZATION_FEE_POLICY_CREATED", "MonetizationFeePolicy", policy.id, { feeType, configured: amount !== null });
    return policy;
};
export const getFeePreview = async (feeType) => {
    const type = enumValue(feeType, Object.values(MonetizationFeeType), "feeType");
    return prisma.monetizationFeePolicy.findFirst({
        where: { feeType: type, isActive: true },
        orderBy: { effectiveAt: "desc" },
    });
};
