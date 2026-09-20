import {
  CheckInStatus,
  MerchantTrafficSource,
  RebalancingStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  calculateExposureIndex,
  calculateHiddenGemScore,
  calculatePercentileRank,
  calculateQualityScore,
  determineGemStatus,
} from "../../common/utils/merchant-score.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";

const EXPOSURE_WINDOW_DAYS = 90;
const ACTIVITY_WINDOW_DAYS = 120;
const MIN_LOCAL_COHORT_SIZE = 5;

const normalizeCohortValue = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase() || "unknown";

const getMerchantCohortKey = (merchant: {
  city?: string | null;
  area?: string | null;
  restaurantType: string;
  mainDishType: string;
}) =>
  [
    merchant.city,
    merchant.area,
    merchant.restaurantType,
    merchant.mainDishType,
  ]
    .map(normalizeCohortValue)
    .join("|");

export const runRebalancing = async () => {
  // Check for any concurrent active rebalancing run
  const activeRun = await prisma.rebalancingRun.findFirst({
    where: { status: RebalancingStatus.Running },
  });

  if (activeRun) {
    const now = new Date();
    const runningMinutes =
      (now.getTime() - new Date(activeRun.startedAt).getTime()) / (1000 * 60);

    if (runningMinutes < 15) {
      throw new AppError(
        409,
        "Hệ thống đang thực hiện Rebalancing, vui lòng đợi tiến trình hiện tại hoàn tất.",
      );
    }

    // Auto-heal hung/stuck runs older than 15 minutes
    await prisma.rebalancingRun.update({
      where: { id: activeRun.id },
      data: {
        status: RebalancingStatus.Failed,
        errorMessage:
          "Tiến trình bị gián đoạn quá thời gian chờ (Stuck timeout recovery)",
        completedAt: now,
      },
    });
  }

  const run = await prisma.rebalancingRun.create({
    data: {
      status: RebalancingStatus.Running,
      startedAt: new Date(),
    },
  });

  try {
    const exposureSince = new Date(
      Date.now() - EXPOSURE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const activitySince = new Date(
      Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    await prisma.merchant.updateMany({
      where: { OR: [{ status: { not: "Active" } }, { listingVisibility: { not: "Public" } }, { safetySuppressed: true }] },
      data: { gemStatus: null },
    });
    const merchants = await prisma.merchant.findMany({
      where: {
        status: "Active",
        listingVisibility: "Public",
        safetySuppressed: false,
      },
      select: {
        id: true,
        name: true,
        rating: true,
        city: true,
        area: true,
        restaurantType: true,
        mainDishType: true,
        recommendationRank: true,
        _count: {
          select: {
            reviews: {
              where: {
                OR: [{ checkInId: { not: null } }, { orderId: { not: null } }],
              },
            },
            checkIns: {
              where: {
                status: CheckInStatus.Verified,
                campaignId: null,
              },
            },
            views: {
              where: {
                createdAt: { gte: exposureSince },
                source: {
                  in: [
                    MerchantTrafficSource.Recommendation,
                    MerchantTrafficSource.Search,
                    MerchantTrafficSource.Map,
                    MerchantTrafficSource.Direct,
                  ],
                },
              },
            },
            wishlists: {
              where: { createdAt: { gte: exposureSince } },
            },
          },
        },
      },
    });

    if (merchants.length === 0) {
      const now = new Date();
      await prisma.rebalancingRun.update({
        where: { id: run.id },
        data: {
          status: RebalancingStatus.Completed,
          merchantCount: 0,
          completedAt: now,
        },
      });

      return {
        runId: run.id,
        status: RebalancingStatus.Completed,
        merchantCount: 0,
        increasedVisibility: 0,
        decreasedVisibility: 0,
        unchangedVisibility: 0,
      };
    }

    const verifiedCheckInGroups = await prisma.checkIn.groupBy({
      by: ["merchantId", "customerId"],
      where: {
        merchantId: { in: merchants.map((merchant) => merchant.id) },
        status: CheckInStatus.Verified,
        campaignId: null,
      },
      _count: { _all: true },
    });
    const recentReviewGroups = await prisma.review.groupBy({
      by: ["merchantId"],
      where: {
        merchantId: { in: merchants.map((merchant) => merchant.id) },
        createdAt: { gte: activitySince },
        OR: [{ checkInId: { not: null } }, { orderId: { not: null } }],
      },
      _count: { _all: true },
    });
    const recentVerifiedCheckInGroups = await prisma.checkIn.groupBy({
      by: ["merchantId"],
      where: {
        merchantId: { in: merchants.map((merchant) => merchant.id) },
        status: CheckInStatus.Verified,
        campaignId: null,
        createdAt: { gte: activitySince },
      },
      _count: { _all: true },
    });
    const recentReviewCounts = new Map(
      recentReviewGroups.map((group) => [group.merchantId, group._count._all]),
    );
    const recentVerifiedVisitCounts = new Map(
      recentVerifiedCheckInGroups.map((group) => [
        group.merchantId,
        group._count._all,
      ]),
    );
    const visitorStats = new Map<
      string,
      { uniqueVisitors: number; repeatCustomers: number }
    >();
    for (const group of verifiedCheckInGroups) {
      const stats = visitorStats.get(group.merchantId) ?? {
        uniqueVisitors: 0,
        repeatCustomers: 0,
      };
      stats.uniqueVisitors += 1;
      if (group._count._all >= 2) stats.repeatCustomers += 1;
      visitorStats.set(group.merchantId, stats);
    }

    const computed = merchants.map((m) => {
      const reviewsCount = m._count.reviews;
      const rating = Number(m.rating);
      const verifiedVisits = m._count.checkIns;
      const recentReviews = recentReviewCounts.get(m.id) ?? 0;
      const recentVerifiedVisits = recentVerifiedVisitCounts.get(m.id) ?? 0;
      const organicViews = m._count.views;
      const wishlists = m._count.wishlists;
      const visitorStat = visitorStats.get(m.id) ?? {
        uniqueVisitors: 0,
        repeatCustomers: 0,
      };
      const repeatRate = visitorStat.uniqueVisitors
        ? visitorStat.repeatCustomers / visitorStat.uniqueVisitors
        : 0;
      const qualityScore = calculateQualityScore({
        rating,
        verifiedReviews: reviewsCount,
        verifiedVisits,
        repeatRate,
      });
      const exposureIndex = calculateExposureIndex({
        organicViews,
        uniqueVisitors: visitorStat.uniqueVisitors,
        reviews: recentReviews,
        wishlists,
      });

      return {
        merchant: m,
        rating,
        strengthIndex: exposureIndex,
        oldRank: m.recommendationRank,
        signals: {
          verifiedVisits,
          reviews: reviewsCount,
          organicViews,
          uniqueVisitors: visitorStat.uniqueVisitors,
          repeatRate,
          wishlists,
          qualityScore,
          exposureIndex,
          recentReviews,
          recentVerifiedVisits,
        },
        cohortKey: getMerchantCohortKey(m),
      };
    });

    const exposureByCohort = new Map<string, number[]>();
    for (const item of computed) {
      const values = exposureByCohort.get(item.cohortKey) ?? [];
      values.push(item.signals.exposureIndex);
      exposureByCohort.set(item.cohortKey, values);
    }
    const globalExposureValues = computed.map(
      (item) => item.signals.exposureIndex,
    );

    const scored = computed.map((c) => {
      const cohortValues = exposureByCohort.get(c.cohortKey) ?? [];
      const comparisonValues =
        cohortValues.length >= MIN_LOCAL_COHORT_SIZE
          ? cohortValues
          : globalExposureValues;
      const exposurePercent = calculatePercentileRank(
        c.signals.exposureIndex,
        comparisonValues,
      );
      const underratedScore = calculateHiddenGemScore(
        c.signals.qualityScore,
        exposurePercent,
      );
      const gemStatus = determineGemStatus({
        rating: c.rating,
        verifiedReviews: c.signals.reviews,
        verifiedVisits: c.signals.verifiedVisits,
        exposure: exposurePercent,
        qualityScore: c.signals.qualityScore,
        recentSignals:
          c.signals.recentReviews + c.signals.recentVerifiedVisits,
      });
      return {
        ...c,
        underratedScore,
        gemStatus,
        exposurePercentile: exposurePercent,
      };
    });

    // Sort by underrated score, quality, then verified visits.
    scored.sort(
      (a, b) =>
        b.underratedScore - a.underratedScore ||
        b.rating - a.rating ||
        b.signals.verifiedVisits - a.signals.verifiedVisits,
    );

    let increasedVisibility = 0;
    let decreasedVisibility = 0;
    let unchangedVisibility = 0;

    const now = new Date();
    const updateOperations = scored.map((item, index) => {
      const newRank = index + 1;

      if (item.oldRank === null || item.oldRank === undefined) {
        unchangedVisibility++;
      } else if (newRank < item.oldRank) {
        // Rank 1 is better than Rank 5 -> moved UP in visibility
        increasedVisibility++;
      } else if (newRank > item.oldRank) {
        decreasedVisibility++;
      } else {
        unchangedVisibility++;
      }

      return prisma.merchant.update({
        where: { id: item.merchant.id },
        data: {
          strengthIndex: item.strengthIndex,
          underratedScore: item.underratedScore,
          recommendationRank: newRank,
          gemStatus: item.gemStatus,
          lastRebalancedAt: now,
        },
      });
    });

    // Execute atomic transaction for all updates with extended timeout to prevent batch timeouts
    await prisma.$transaction(updateOperations, {
      timeout: 30000,
      maxWait: 10000,
    });

    await prisma.rebalancingRun.update({
      where: { id: run.id },
      data: {
        status: RebalancingStatus.Completed,
        merchantCount: scored.length,
        increasedVisibility,
        decreasedVisibility,
        unchangedVisibility,
        completedAt: now,
      },
    });

    // Invalidate stale recommendation cache after rebalancing completes
    recommendationCache.clear();

    return {
      runId: run.id,
      status: RebalancingStatus.Completed,
      merchantCount: scored.length,
      increasedVisibility,
      decreasedVisibility,
      unchangedVisibility,
      completedAt: now,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Thất bại khi chạy rebalancing";

    await prisma.rebalancingRun.update({
      where: { id: run.id },
      data: {
        status: RebalancingStatus.Failed,
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    }).catch(() => null);

    throw new AppError(500, `Rebalancing job failed: ${errorMsg}`);
  }
};

export const getRebalancingStatus = async () => {
  const latestRun = await prisma.rebalancingRun.findFirst({
    orderBy: { startedAt: "desc" },
  });

  const totalMerchants = await prisma.merchant.count({
    where: { status: "Active" },
  });

  const sampleMerchants = await prisma.merchant.findMany({
    where: { status: "Active" },
    select: {
      id: true,
      name: true,
      rating: true,
      strengthIndex: true,
      underratedScore: true,
      recommendationRank: true,
      gemStatus: true,
      lastRebalancedAt: true,
    },
    orderBy: [
      { recommendationRank: "asc" },
      { underratedScore: "desc" },
    ],
    take: 20,
  });

  return {
    lastUpdatedAt: latestRun?.completedAt || latestRun?.startedAt || null,
    status: latestRun?.status || "Idle",
    merchantCount: totalMerchants,
    increasedVisibility: latestRun?.increasedVisibility || 0,
    decreasedVisibility: latestRun?.decreasedVisibility || 0,
    unchangedVisibility: latestRun?.unchangedVisibility || 0,
    latestRun,
    merchants: sampleMerchants.map((m) => ({
      id: m.id,
      name: m.name,
      rating: Number(m.rating),
      strengthIndex: Number(m.strengthIndex),
      underratedScore: Number(m.underratedScore),
      recommendationRank: m.recommendationRank,
      gemStatus: m.gemStatus,
      lastRebalancedAt: m.lastRebalancedAt,
    })),
  };
};
