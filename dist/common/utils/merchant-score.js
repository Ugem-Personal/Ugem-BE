/**
 * Organic merchant strength used by the rebalancing engine.
 *
 * SI = verified visits * 0.5 + reviews * 0.3 + (organic views / 10) * 0.2
 */
export const calculateStrengthIndex = (verifiedVisits, reviews, organicViews) => {
    const rawScore = verifiedVisits * 0.5 +
        reviews * 0.3 +
        (organicViews / 10) * 0.2;
    return Number(Math.max(0, rawScore).toFixed(2));
};
export const GEM_THRESHOLDS = {
    minimumRating: 4,
    minimumReviews: 3,
    minimumVerifiedVisits: 3,
    hiddenMaxExposure: 20,
    risingMaxExposure: 60,
};
export const determineGemStatus = (input) => {
    if (input.rating < GEM_THRESHOLDS.minimumRating || input.verifiedReviews < GEM_THRESHOLDS.minimumReviews || input.verifiedVisits < GEM_THRESHOLDS.minimumVerifiedVisits)
        return null;
    if (input.exposure < GEM_THRESHOLDS.hiddenMaxExposure)
        return "HiddenGem";
    if (input.exposure < GEM_THRESHOLDS.risingMaxExposure)
        return "RisingGem";
    return "HallOfFame";
};
export const calculateOrganicRecommendationScore = (input) => Number((input.checkInScore * 0.4 + input.ratingScore * 0.2 + input.distanceScore * 0.2 + input.preferenceOrUnderratedScore * 0.1).toFixed(2));
export const calculateNormalizedUnderratedScore = (strengthIndex, maxStrengthIndex, rating) => {
    if (strengthIndex <= 0 || maxStrengthIndex <= 0)
        return 0;
    const normalizedSI = Math.max(0, Math.min(strengthIndex / maxStrengthIndex, 1));
    const quality = Math.max(0, Math.min(rating / 5, 1));
    // High rating + low SI = high underrated score (store quality vs traffic)
    return Number((quality * (1 - normalizedSI)).toFixed(4));
};
