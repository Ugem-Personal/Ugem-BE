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
export const calculateStrengthIndex = (orders, reviews, views, checkIns = 0) => {
    // SI = f(O, R, V, C) where O=Orders, R=Reviews, V=Views, C=CheckIns
    const oWeight = 0.35;
    const rWeight = 0.25;
    const vWeight = 0.25;
    const cWeight = 0.15;
    const rawScore = orders * oWeight +
        reviews * rWeight +
        (views / 10) * vWeight +
        checkIns * cWeight;
    return Number(Math.max(0, rawScore).toFixed(2));
};
export const calculateNormalizedUnderratedScore = (strengthIndex, maxStrengthIndex, rating) => {
    const normalizedSI = maxStrengthIndex > 0 ? strengthIndex / maxStrengthIndex : 0;
    const quality = Math.max(0, Math.min(rating / 5, 1));
    // High rating + low SI = high underrated score (store quality vs traffic)
    return Number((quality * (1 - normalizedSI)).toFixed(4));
};
