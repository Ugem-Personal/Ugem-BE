import { RebalancingStatus } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  calculateNormalizedUnderratedScore,
  calculateStrengthIndex,
} from "../../common/utils/merchant-score.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";

export const runRebalancing = async () => {
  const run = await prisma.rebalancingRun.create({
    data: {
      status: RebalancingStatus.Running,
      startedAt: new Date(),
    },
  });

  try {
    const merchants = await prisma.merchant.findMany({
      where: {
        status: "Active",
      },
      select: {
        id: true,
        name: true,
        rating: true,
        totalViews: true,
        recommendationRank: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
            checkIns: true,
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

    const computed = merchants.map((m) => {
      const ordersCount = m._count.orders;
      const reviewsCount = m._count.reviews;
      const viewsCount = m.totalViews;
      const si = calculateStrengthIndex(ordersCount, reviewsCount, viewsCount);

      return {
        merchant: m,
        rating: Number(m.rating),
        si,
        oldRank: m.recommendationRank,
      };
    });

    const maxSI = Math.max(...computed.map((c) => c.si), 0);

    const scored = computed.map((c) => {
      const us = calculateNormalizedUnderratedScore(c.si, maxSI, c.rating);
      return { ...c, us };
    });

    // Sort descending by underrated score. Higher US gets higher recommendation rank (1, 2, 3...)
    scored.sort((a, b) => b.us - a.us || b.rating - a.rating);

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
          strengthIndex: item.si,
          underratedScore: item.us,
          recommendationRank: newRank,
          lastRebalancedAt: now,
        },
      });
    });

    // Execute atomic transaction for all updates to safeguard existing ranks in case of failure
    await prisma.$transaction(updateOperations);

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
      lastRebalancedAt: m.lastRebalancedAt,
    })),
  };
};
