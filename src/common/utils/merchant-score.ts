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
  minimumReviews: 3,
  minimumVerifiedVisits: 3,
  hiddenMaxExposure: 20,
  risingMaxExposure: 60,
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Quality uses only signals tied to real customer experience. */
export const calculateQualityScore = (input: {
  rating: number;
  verifiedReviews: number;
  verifiedVisits: number;
  repeatRate?: number;
}) => {
  const ratingScore = clamp(input.rating / 5);
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
  exposureIndex: number,
  maxExposureIndex: number,
) => {
  if (qualityScore <= 0 || maxExposureIndex <= 0) return 0;
  const exposureRatio = clamp(exposureIndex / maxExposureIndex);
  return Number((clamp(qualityScore) * (1 - exposureRatio)).toFixed(4));
};

export type GemStatus = "HiddenGem" | "RisingGem" | "HallOfFame";

export const determineGemStatus = (input: {
  rating: number;
  verifiedReviews: number;
  verifiedVisits: number;
  exposure: number;
}): GemStatus | null => {
  if (input.rating < GEM_THRESHOLDS.minimumRating || input.verifiedReviews < GEM_THRESHOLDS.minimumReviews || input.verifiedVisits < GEM_THRESHOLDS.minimumVerifiedVisits) return null;
  if (input.exposure < GEM_THRESHOLDS.hiddenMaxExposure) return "HiddenGem";
  if (input.exposure < GEM_THRESHOLDS.risingMaxExposure) return "RisingGem";
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
