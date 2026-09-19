import { CheckInStatus, MerchantTrafficSource, RebalancingStatus, } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { calculateNormalizedUnderratedScore, calculateStrengthIndex, determineGemStatus, } from "../../common/utils/merchant-score.js";
import { recommendationCache } from "../../common/services/recommendation-cache.js";
export const runRebalancing = async () => {
    // Check for any concurrent active rebalancing run
    const activeRun = await prisma.rebalancingRun.findFirst({
        where: { status: RebalancingStatus.Running },
    });
    if (activeRun) {
        const now = new Date();
        const runningMinutes = (now.getTime() - new Date(activeRun.startedAt).getTime()) / (1000 * 60);
        if (runningMinutes < 15) {
            throw new AppError(409, "Hệ thống đang thực hiện Rebalancing, vui lòng đợi tiến trình hiện tại hoàn tất.");
        }
        // Auto-heal hung/stuck runs older than 15 minutes
        await prisma.rebalancingRun.update({
            where: { id: activeRun.id },
            data: {
                status: RebalancingStatus.Failed,
                errorMessage: "Tiến trình bị gián đoạn quá thời gian chờ (Stuck timeout recovery)",
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
                recommendationRank: true,
                _count: {
                    select: {
                        reviews: true,
                        checkIns: {
                            where: {
                                status: CheckInStatus.Verified,
                                campaignId: null,
                            },
                        },
                        views: {
                            where: {
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
                    },
                },
                reviews: { select: { rating: true } },
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
            const reviewsCount = m._count.reviews;
            const rating = Number(m.rating);
            const verifiedVisits = m._count.checkIns;
            const organicViews = m._count.views;
            const strengthIndex = calculateStrengthIndex(verifiedVisits, reviewsCount, organicViews);
            return {
                merchant: m,
                rating,
                strengthIndex,
                oldRank: m.recommendationRank,
                signals: {
                    verifiedVisits,
                    reviews: reviewsCount,
                    organicViews,
                },
                gemStatus: determineGemStatus({
                    rating,
                    verifiedReviews: reviewsCount,
                    verifiedVisits,
                    exposure: strengthIndex,
                }),
            };
        });
        const maxStrengthIndex = Math.max(...computed.map((c) => c.strengthIndex), 0);
        const scored = computed.map((c) => {
            const underratedScore = calculateNormalizedUnderratedScore(c.strengthIndex, maxStrengthIndex, c.rating);
            return { ...c, underratedScore };
        });
        // Sort by underrated score, quality, then verified visits.
        scored.sort((a, b) => b.underratedScore - a.underratedScore ||
            b.rating - a.rating ||
            b.signals.verifiedVisits - a.signals.verifiedVisits);
        let increasedVisibility = 0;
        let decreasedVisibility = 0;
        let unchangedVisibility = 0;
        const now = new Date();
        const updateOperations = scored.map((item, index) => {
            const newRank = index + 1;
            if (item.oldRank === null || item.oldRank === undefined) {
                unchangedVisibility++;
            }
            else if (newRank < item.oldRank) {
                // Rank 1 is better than Rank 5 -> moved UP in visibility
                increasedVisibility++;
            }
            else if (newRank > item.oldRank) {
                decreasedVisibility++;
            }
            else {
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
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Thất bại khi chạy rebalancing";
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
