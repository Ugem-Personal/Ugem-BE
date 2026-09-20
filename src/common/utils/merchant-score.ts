/**
 * Discovery scores used by the rebalancing engine.
 *
 * Quality and exposure are scored separately so popularity does not look like
 * quality and highly rated, low exposure places can be surfaced as gems.
 */
export const calculateStrengthIndex = (
  verifiedVisits: number,
  reviews: number,
  organicViews: number,
): number => {
  const rawScore =
    verifiedVisits * 0.5 +
    reviews * 0.3 +
    (organicViews / 10) * 0.2;

  return Number(Math.max(0, rawScore).toFixed(2));
};

export const GEM_THRESHOLDS = {
  minimumRating: 4.5,
  minimumReviews: 5,
  minimumVerifiedVisits: 5,
  minimumRecentSignals: 1,
  minimumConfidenceAdjustedRating: 4.35,
  hiddenMaxExposurePercentile: 35,
  risingMaxExposurePercentile: 70,
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Shrinks small-sample ratings toward the local prior so a 5.0 from three
 * reviews does not outrank a stable 4.7 from a much larger sample.
 */
export const calculateBayesianRating = (
  rating: number,
  reviewCount: number,
  priorRating = 4.2,
  priorWeight = 10,
) => {
  const safeRating = Math.max(0, Math.min(5, rating));
  const safeReviewCount = Math.max(0, reviewCount);
  const confidence =
    safeReviewCount / Math.max(1, safeReviewCount + priorWeight);

  return Number(
    (
      safeRating * confidence +
      Math.max(0, Math.min(5, priorRating)) * (1 - confidence)
    ).toFixed(4),
  );
};

/** Quality uses only signals tied to real customer experience. */
export const calculateQualityScore = (input: {
  rating: number;
  verifiedReviews: number;
  verifiedVisits: number;
  repeatRate?: number;
}) => {
  const confidenceAdjustedRating = calculateBayesianRating(
    input.rating,
    input.verifiedReviews,
  );
  const ratingScore = clamp(confidenceAdjustedRating / 5);
  const reviewConfidence = clamp(input.verifiedReviews / 10);
  const visitConfidence = clamp(input.verifiedVisits / 10);
  const repeatRate = clamp(input.repeatRate ?? 0);

  return Number(
    (
      ratingScore * 0.5 +
      reviewConfidence * 0.2 +
      visitConfidence * 0.2 +
      repeatRate * 0.1
    ).toFixed(4),
  );
};

/** Exposure is kept separate from quality so popular places are not gems. */
export const calculateExposureIndex = (input: {
  organicViews: number;
  uniqueVisitors: number;
  reviews: number;
  wishlists: number;
}) =>
  Number(
    (
      Math.log1p(Math.max(0, input.organicViews)) * 0.45 +
      Math.log1p(Math.max(0, input.uniqueVisitors)) * 0.25 +
      Math.log1p(Math.max(0, input.reviews)) * 0.15 +
      Math.log1p(Math.max(0, input.wishlists)) * 0.15
    ).toFixed(4),
  );

export const calculateHiddenGemScore = (
  qualityScore: number,
  exposurePercentile: number,
) => {
  if (qualityScore <= 0) return 0;
  const exposureRatio = clamp(exposurePercentile / 100);
  return Number((clamp(qualityScore) * (1 - exposureRatio)).toFixed(4));
};

/** Return the percentile of a value inside its comparison cohort. */
export const calculatePercentileRank = (
  value: number,
  cohortValues: number[],
) => {
  const values = cohortValues.filter((item) => Number.isFinite(item));
  if (values.length < 2) return 50;

  const lower = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;

  return Number((((lower + equal * 0.5) / values.length) * 100).toFixed(2));
};

export type GemStatus = "HiddenGem" | "RisingGem" | "HallOfFame";

export const determineGemStatus = (input: {
  rating: number;
  verifiedReviews: number;
  verifiedVisits: number;
  exposure: number;
  qualityScore?: number;
  recentSignals?: number;
}): GemStatus | null => {
  const qualityScore =
    input.qualityScore ??
    calculateQualityScore({
      rating: input.rating,
      verifiedReviews: input.verifiedReviews,
      verifiedVisits: input.verifiedVisits,
    });
  const confidenceAdjustedRating = calculateBayesianRating(
    input.rating,
    input.verifiedReviews,
  );

  if (
    input.rating < GEM_THRESHOLDS.minimumRating ||
    confidenceAdjustedRating < GEM_THRESHOLDS.minimumConfidenceAdjustedRating ||
    input.verifiedReviews < GEM_THRESHOLDS.minimumReviews ||
    input.verifiedVisits < GEM_THRESHOLDS.minimumVerifiedVisits ||
    (input.recentSignals ?? 0) < GEM_THRESHOLDS.minimumRecentSignals ||
    qualityScore <= 0
  ) {
    return null;
  }

  if (input.exposure < GEM_THRESHOLDS.hiddenMaxExposurePercentile) {
    return "HiddenGem";
  }
  if (input.exposure < GEM_THRESHOLDS.risingMaxExposurePercentile) {
    return "RisingGem";
  }
  return "HallOfFame";
};

export const calculateOrganicRecommendationScore = (input: {
  checkInScore: number;
  ratingScore: number;
  distanceScore: number;
  preferenceOrUnderratedScore: number;
}) =>
  Number((input.checkInScore * 0.4 + input.ratingScore * 0.2 + input.distanceScore * 0.2 + input.preferenceOrUnderratedScore * 0.1).toFixed(2));

export const calculateNormalizedUnderratedScore = (
  strengthIndex: number,
  maxStrengthIndex: number,
  rating: number,
): number => {
  if (strengthIndex <= 0 || maxStrengthIndex <= 0) return 0;

  const normalizedSI = Math.max(
    0,
    Math.min(strengthIndex / maxStrengthIndex, 1),
  );

  const quality = Math.max(0, Math.min(rating / 5, 1));

  // High rating + low SI = high underrated score (store quality vs traffic)
  return Number((quality * (1 - normalizedSI)).toFixed(4));
};
