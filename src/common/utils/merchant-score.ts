/**
 * Flow 4: Rebalancing Engine - SI & US Score Calculation
 * 
 * Formula:
 * SI = f(O, R, V) where:
 *   O = Total Orders
 *   R = Review Count
 *   V = Total Views / Interactions
 * 
 * Underrated Score (US): Evaluates store quality vs visibility/traffic.
 */

export const calculateStrengthIndex = (
  orders: number,
  reviews: number,
  views: number,
): number => {
  // SI = f(O, R, V)
  const oWeight = 0.4;
  const rWeight = 0.3;
  const vWeight = 0.3;

  const rawScore = orders * oWeight + reviews * rWeight + (views / 10) * vWeight;
  return Number(Math.max(0, rawScore).toFixed(2));
};

export const calculateUnderratedScore = (
  rating: number,
  reviewCount: number = 0,
  totalViews: number = 0,
): number => {
  const normalizedRating = Math.max(0, Math.min(rating / 5, 1));
  
  // Higher rating with low reviewCount/views = higher underrated score
  if (reviewCount < 50 && totalViews < 500) {
    const boost = 1.15;
    return Number(Math.min(normalizedRating * boost, 1.0).toFixed(2));
  }

  // Crowded store (high views & reviews): slightly reduced underrated priority
  if (reviewCount > 200 || totalViews > 2000) {
    const penalty = 0.85;
    return Number((normalizedRating * penalty).toFixed(2));
  }

  return Number(normalizedRating.toFixed(2));
};
