import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MerchantClaimStatus,
  MerchantListingVisibility,
  MerchantRemovalStatus,
  MerchantVerificationStatus,
  FunnelEventType,
  MonetizationFeeType,
  RestaurantSuggestionStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

export type AuditActor = { userId: string; role: UserRole };

const audit = async (actor: AuditActor, action: string, entityType: string, entityId: string, metadata?: object) => {
  await prisma.auditLog.create({
    data: { actorUserId: actor.userId, actorRole: actor.role, action, entityType, entityId, metadata },
  });
};

const requireText = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) throw new AppError(400, `${field} là bắt buộc`);
  return value.trim();
};

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], field: string): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new AppError(400, `${field} không hợp lệ`);
  return value as T;
};

const urls = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 10) : [];

export const createIncident = async (actor: AuditActor, input: Record<string, unknown>) => {
  const merchantId = requireText(input.merchantId, "merchantId");
  const description = requireText(input.description, "description");
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  if (!merchant) throw new AppError(404, "Không tìm thấy Merchant");

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

export const listIncidents = async (filters: { status?: string; merchantId?: string; reporterUserId?: string }) => prisma.merchantIncident.findMany({
  where: { status: filters.status as IncidentStatus | undefined, merchantId: filters.merchantId, reporterUserId: filters.reporterUserId },
  orderBy: { createdAt: "desc" },
  take: 200,
});

export const reviewIncident = async (actor: AuditActor, incidentId: string, input: Record<string, unknown>) => {
  const incident = await prisma.merchantIncident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError(404, "Không tìm thấy Incident");
  const status = enumValue(input.status, Object.values(IncidentStatus), "status");
  const severity = input.severity === undefined ? incident.severity : enumValue(input.severity, Object.values(IncidentSeverity), "severity");
  const shouldSuppress = severity === IncidentSeverity.High || severity === IncidentSeverity.Critical;
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.merchantIncident.update({
      where: { id: incidentId },
      data: { status, severity, adminDecision: typeof input.adminDecision === "string" ? input.adminDecision.trim() : null, resolution: typeof input.resolution === "string" ? input.resolution.trim() : null, reviewedByUserId: actor.userId, reviewedAt: new Date() },
    });
    if (status === IncidentStatus.Resolved || status === IncidentStatus.Rejected) {
      const activeRisk = await transaction.merchantIncident.count({ where: { merchantId: incident.merchantId, status: { in: [IncidentStatus.Open, IncidentStatus.UnderReview] }, severity: { in: [IncidentSeverity.High, IncidentSeverity.Critical] }, id: { not: incidentId } } });
      if (activeRisk === 0) await transaction.merchant.update({ where: { id: incident.merchantId }, data: { safetySuppressed: false, safetyRiskScore: 0 } });
    } else if (shouldSuppress) {
      await transaction.merchant.update({ where: { id: incident.merchantId }, data: { verificationStatus: MerchantVerificationStatus.UnderReview, safetySuppressed: true, safetyRiskScore: severity === IncidentSeverity.Critical ? 1 : 0.7, listingVisibility: severity === IncidentSeverity.Critical ? MerchantListingVisibility.Hidden : undefined } });
      if (severity === IncidentSeverity.Critical) await transaction.campaign.updateMany({ where: { merchantId: incident.merchantId, isActive: true }, data: { isActive: false } });
    }
    return next;
  });
  await audit(actor, "MERCHANT_INCIDENT_REVIEWED", "MerchantIncident", incidentId, { status, severity, merchantId: incident.merchantId });
  return updated;
};

export const createClaim = async (actor: AuditActor, input: Record<string, unknown>) => {
  const merchantId = requireText(input.merchantId, "merchantId");
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  if (!merchant) throw new AppError(404, "Không tìm thấy Merchant");
  const existing = await prisma.merchantClaim.findFirst({ where: { merchantId, status: { in: [MerchantClaimStatus.Pending, MerchantClaimStatus.UnderReview] } } });
  if (existing) throw new AppError(409, "Merchant đã có claim đang được xử lý");
  const claim = await prisma.merchantClaim.create({ data: { merchantId, submittedByUserId: actor.userId, evidenceUrls: urls(input.evidenceUrls) } });
  await audit(actor, "MERCHANT_CLAIM_CREATED", "MerchantClaim", claim.id, { merchantId });
  return claim;
};

export const createRemovalRequest = async (actor: AuditActor, input: Record<string, unknown>) => {
  const merchantId = requireText(input.merchantId, "merchantId");
  const reason = requireText(input.reason, "reason");
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  if (!merchant) throw new AppError(404, "Không tìm thấy Merchant");
  const request = await prisma.merchantRemovalRequest.create({ data: { merchantId, submittedByUserId: actor.userId, reason } });
  await audit(actor, "MERCHANT_REMOVAL_REQUESTED", "MerchantRemovalRequest", request.id, { merchantId });
  return request;
};

export const reviewClaim = async (actor: AuditActor, id: string, input: Record<string, unknown>) => {
  const claim = await prisma.merchantClaim.findUnique({ where: { id } });
  if (!claim) throw new AppError(404, "Không tìm thấy Claim");
  const status = enumValue(input.status, Object.values(MerchantClaimStatus), "status");
  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.merchantClaim.update({ where: { id }, data: { status, decision: typeof input.decision === "string" ? input.decision.trim() : null, reviewedByUserId: actor.userId, reviewedAt: new Date() } });
    if (status === MerchantClaimStatus.Approved) await transaction.merchant.update({ where: { id: claim.merchantId }, data: { verificationStatus: MerchantVerificationStatus.VerifiedBusiness, listingVisibility: MerchantListingVisibility.Public } });
    return result;
  });
  await audit(actor, "MERCHANT_CLAIM_REVIEWED", "MerchantClaim", id, { status, merchantId: claim.merchantId });
  return updated;
};

export const reviewRemoval = async (actor: AuditActor, id: string, input: Record<string, unknown>) => {
  const request = await prisma.merchantRemovalRequest.findUnique({ where: { id } });
  if (!request) throw new AppError(404, "Không tìm thấy Removal Request");
  const status = enumValue(input.status, Object.values(MerchantRemovalStatus), "status");
  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.merchantRemovalRequest.update({ where: { id }, data: { status, decision: typeof input.decision === "string" ? input.decision.trim() : null, reviewedByUserId: actor.userId, reviewedAt: new Date() } });
    if (status === MerchantRemovalStatus.Approved) {
      await transaction.merchant.update({ where: { id: request.merchantId }, data: { status: "Inactive", verificationStatus: MerchantVerificationStatus.Removed, listingVisibility: MerchantListingVisibility.Hidden, safetySuppressed: true } });
      await transaction.campaign.updateMany({ where: { merchantId: request.merchantId, isActive: true }, data: { isActive: false } });
    }
    return result;
  });
  await audit(actor, "MERCHANT_REMOVAL_REVIEWED", "MerchantRemovalRequest", id, { status, merchantId: request.merchantId });
  return updated;
};

export const createSuggestion = async (actor: AuditActor, input: Record<string, unknown>) => {
  const suggestion = await prisma.restaurantSuggestion.create({ data: { name: requireText(input.name, "name"), address: requireText(input.address, "address"), category: typeof input.category === "string" ? input.category.trim() : null, recommendedDish: typeof input.recommendedDish === "string" ? input.recommendedDish.trim() : null, description: typeof input.description === "string" ? input.description.trim() : null, images: urls(input.images), reason: requireText(input.reason, "reason"), submittedByUserId: actor.userId } });
  await audit(actor, "RESTAURANT_SUGGESTION_CREATED", "RestaurantSuggestion", suggestion.id);
  return suggestion;
};

export const reviewSuggestion = async (actor: AuditActor, id: string, input: Record<string, unknown>) => {
  const status = enumValue(input.status, Object.values(RestaurantSuggestionStatus), "status");
  const suggestion = await prisma.restaurantSuggestion.update({ where: { id }, data: { status, reviewedByUserId: actor.userId, reviewedAt: new Date() } }).catch(() => { throw new AppError(404, "Không tìm thấy Suggestion"); });
  await audit(actor, "RESTAURANT_SUGGESTION_REVIEWED", "RestaurantSuggestion", id, { status });
  return suggestion;
};

export const getMerchantAnalytics = async (merchantId: string) => {
  const [views, saves, checkIns, verifiedVisits, reviews, acquisitions, repeatVisitors] = await prisma.$transaction([
    prisma.merchantView.count({ where: { merchantId } }),
    prisma.wishlist.count({ where: { merchantId } }),
    prisma.checkIn.count({ where: { merchantId } }),
    prisma.checkIn.count({ where: { merchantId, status: "Verified" } }),
    prisma.review.count({ where: { merchantId } }),
    prisma.merchantAcquisitionEvent.count({ where: { merchantId } }),
    prisma.merchantAcquisitionEvent.groupBy({ by: ["customerId"], where: { merchantId }, _count: { customerId: true }, having: { customerId: { _count: { gt: 1 } } } }),
  ]);
  return { views, saves, visits: verifiedVisits, checkIns, verifiedVisits, repeatVisitors: repeatVisitors.length, reviewCount: reviews, acquisitionEvents: acquisitions, conversionRate: views ? verifiedVisits / views : 0, paidAcquisition: 0 };
};

export const listModeration = async (kind: "incidents" | "claims" | "removals" | "suggestions") => {
  if (kind === "incidents") return prisma.merchantIncident.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  if (kind === "claims") return prisma.merchantClaim.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  if (kind === "removals") return prisma.merchantRemovalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return prisma.restaurantSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
};

export const createFunnelEvent = async (input: { eventType: string; userId?: string; merchantId?: string; sessionKey?: string; metadata?: unknown }) => {
  const eventType = enumValue(input.eventType, Object.values(FunnelEventType), "eventType");
  return prisma.funnelEvent.create({ data: { eventType, userId: input.userId, merchantId: input.merchantId, sessionKey: input.sessionKey, metadata: input.metadata as never } });
};

export const getFunnelSummary = async () => {
  const rows = await prisma.funnelEvent.groupBy({ by: ["eventType"], _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.eventType, row._count._all]));
};

export const listFeePolicies = async () => prisma.monetizationFeePolicy.findMany({ orderBy: [{ feeType: "asc" }, { effectiveAt: "desc" }] });

export const upsertFeePolicy = async (actor: AuditActor, input: Record<string, unknown>) => {
  const feeType = enumValue(input.feeType, Object.values(MonetizationFeeType), "feeType");
  const amount = input.amount === null || input.amount === undefined || input.amount === "" ? null : Number(input.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new AppError(400, "amount không hợp lệ");
  const policy = await prisma.monetizationFeePolicy.create({ data: { feeType, amount, currency: typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "VND", isActive: input.isActive === true, metadata: input.metadata as never } });
  await audit(actor, "MONETIZATION_FEE_POLICY_CREATED", "MonetizationFeePolicy", policy.id, { feeType, configured: amount !== null });
  return policy;
};

export const getFeePreview = async (feeType: string) => {
  const type = enumValue(feeType, Object.values(MonetizationFeeType), "feeType");
  return prisma.monetizationFeePolicy.findFirst({ where: { feeType: type, isActive: true }, orderBy: { effectiveAt: "desc" } });
};
