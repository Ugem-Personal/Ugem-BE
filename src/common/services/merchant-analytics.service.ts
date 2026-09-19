import {
  MerchantTrafficSource,
  MonetizationFeeType,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/prisma.js";

const ORGANIC_VIEW_SOURCES = new Set<string>([
  MerchantTrafficSource.Recommendation,
  MerchantTrafficSource.Search,
  MerchantTrafficSource.Map,
  MerchantTrafficSource.Direct,
]);

const toRate = (numerator: number, denominator: number) =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

export const getMerchantAnalytics = async (
  merchantId: string,
  range: { from?: Date; to?: Date } = {},
) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true },
  });

  if (!merchant) return null;

  const occurredAt =
    range.from || range.to
      ? { gte: range.from, lte: range.to }
      : undefined;
  const createdAt = occurredAt;

  const [acquisitionEvents, viewRows, saves, reviewCount, feePolicy] =
    await Promise.all([
      prisma.merchantAcquisitionEvent.findMany({
        where: {
          merchantId,
          status: "Valid",
          occurredAt,
        },
        select: {
          customerId: true,
          campaignId: true,
          source: true,
          occurredAt: true,
        },
      }),
      prisma.merchantView.groupBy({
        by: ["source"],
        where: { merchantId, createdAt },
        _count: { _all: true },
      }),
      prisma.wishlist.count({ where: { merchantId, createdAt } }),
      prisma.review.count({
        where: {
          merchantId,
          checkInId: { not: null },
          createdAt,
        },
      }),
      prisma.monetizationFeePolicy.findFirst({
        where: {
          feeType: MonetizationFeeType.VerifiedVisitFee,
          isActive: true,
        },
        orderBy: { effectiveAt: "desc" },
      }),
    ]);

  const verifiedVisits = acquisitionEvents.length;
  const visitorsByCustomer = new Map<string, number>();

  for (const event of acquisitionEvents) {
    visitorsByCustomer.set(
      event.customerId,
      (visitorsByCustomer.get(event.customerId) ?? 0) + 1,
    );
  }

  const uniqueVisitors = visitorsByCustomer.size;
  const repeatVisitors = [...visitorsByCustomer.values()].filter(
    (count) => count > 1,
  ).length;
  const repeatVisits = Math.max(verifiedVisits - uniqueVisitors, 0);

  const visitsBySource = acquisitionEvents.reduce<Record<string, number>>(
    (result, event) => {
      const source = event.source ?? "Unknown";
      result[source] = (result[source] ?? 0) + 1;
      return result;
    },
    {},
  );

  const viewsBySource = Object.fromEntries(
    viewRows.map((row) => [row.source, row._count._all]),
  );
  const totalViews = viewRows.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const organicViews = viewRows
    .filter((row) => ORGANIC_VIEW_SOURCES.has(row.source))
    .reduce((total, row) => total + row._count._all, 0);
  const sponsoredViews = viewsBySource[MerchantTrafficSource.Sponsored] ?? 0;

  const campaignVerifiedVisits = acquisitionEvents.filter(
    (event) => event.campaignId !== null,
  ).length;
  const nonCampaignVerifiedVisits = acquisitionEvents.filter(
    (event) => event.campaignId === null,
  ).length;

  const feePerVerifiedVisit =
    feePolicy?.amount !== null && feePolicy?.amount !== undefined
      ? Number(feePolicy.amount)
      : null;
  const billingPreview = {
    billableVerifiedVisits: campaignVerifiedVisits,
    feePerVerifiedVisit,
    estimatedAmount:
      feePerVerifiedVisit === null
        ? null
        : campaignVerifiedVisits * feePerVerifiedVisit,
    currency: feePolicy?.currency ?? null,
    isEstimate: true,
    billingStatus: "PreviewOnly" as const,
  };

  return {
    merchant,
    period: {
      from: range.from ?? null,
      to: range.to ?? null,
    },
    traffic: {
      totalViews,
      organicViews,
      sponsoredViews,
      viewsBySource,
      saves,
    },
    visits: {
      verifiedVisits,
      uniqueVisitors,
      repeatVisitors,
      repeatVisits,
      campaignVerifiedVisits,
      nonCampaignVerifiedVisits,
    },
    reviews: {
      reviewCount,
      reviewConversionRate: toRate(reviewCount, verifiedVisits),
    },
    conversion: {
      visitConversionRate: toRate(verifiedVisits, totalViews),
      sponsoredConversionRate: toRate(
        campaignVerifiedVisits,
        sponsoredViews,
      ),
      nonCampaignConversionRate: toRate(nonCampaignVerifiedVisits, organicViews),
    },
    acquisition: {
      bySource: visitsBySource,
    },
    billingPreview,
    // Compatibility with the earlier moderation analytics response.
    views: totalViews,
    saves,
    verifiedVisits,
    repeatVisitors,
    reviewCount,
    acquisitionEvents: verifiedVisits,
    conversionRate: totalViews > 0 ? verifiedVisits / totalViews : 0,
    paidAcquisition: 0,
  };
};
