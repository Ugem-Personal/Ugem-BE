import { describe, expect, it } from "vitest";

import {
  calculateBayesianRating,
  calculateOrganicRecommendationScore,
  calculateNormalizedUnderratedScore,
  calculatePercentileRank,
  calculateQualityScore,
  calculateStrengthIndex,
  determineGemStatus,
} from "./merchant-score.js";

it("calculates organic recommendation score from organic signals", () => {
  const organic = calculateOrganicRecommendationScore({ checkInScore: 40, ratingScore: 80, distanceScore: 90, preferenceOrUnderratedScore: 50 });
  expect(organic).toBe(55);
});

describe("merchant-score utils", () => {
  describe("calculateStrengthIndex", () => {
    it("tính SI theo Verified Visits, Reviews và Organic Views", () => {
      // SI = 10*0.5 + 4*0.3 + (100/10)*0.2 = 8.2
      const si = calculateStrengthIndex(10, 4, 100);
      expect(si).toBe(8.2);
    });

    it("trả về 0 khi tất cả các chỉ số đều bằng 0", () => {
      const si = calculateStrengthIndex(0, 0, 0);
      expect(si).toBe(0);
    });
  });

  it("classifies organic gem lifecycle", () => {
    const signals = { rating: 4.7, verifiedReviews: 12, verifiedVisits: 12, recentSignals: 3, qualityScore: 0.9 };
    expect(determineGemStatus({ ...signals, exposure: 20 })).toBe("HiddenGem");
    expect(determineGemStatus({ ...signals, exposure: 50 })).toBe("RisingGem");
    expect(determineGemStatus({ ...signals, exposure: 80 })).toBe("HallOfFame");
    expect(determineGemStatus({ ...signals, recentSignals: 0, exposure: 1 })).toBeNull();
    expect(determineGemStatus({ rating: 5, verifiedReviews: 3, verifiedVisits: 3, recentSignals: 3, exposure: 1 })).toBeNull();
  });

  it("keeps gem classification deterministic for the same organic signals", () => {
    const organic = determineGemStatus({ rating: 4.7, verifiedReviews: 12, verifiedVisits: 12, recentSignals: 3, exposure: 10, qualityScore: 0.9 });
    const sponsored = determineGemStatus({ rating: 4.7, verifiedReviews: 12, verifiedVisits: 12, recentSignals: 3, exposure: 10, qualityScore: 0.9 });
    expect(sponsored).toBe(organic);
  });

  it("shrinks small-sample ratings toward the local prior", () => {
    expect(calculateBayesianRating(5, 3)).toBeLessThan(4.5);
    expect(calculateBayesianRating(4.7, 40)).toBeGreaterThan(4.55);
  });

  it("uses the adjusted rating inside quality scoring", () => {
    const smallSample = calculateQualityScore({ rating: 5, verifiedReviews: 3, verifiedVisits: 3 });
    const stableSample = calculateQualityScore({ rating: 4.7, verifiedReviews: 40, verifiedVisits: 20 });
    expect(stableSample).toBeGreaterThan(smallSample);
  });

  it("calculates a cohort percentile", () => {
    expect(calculatePercentileRank(10, [10, 20, 30, 40])).toBe(12.5);
    expect(calculatePercentileRank(30, [10, 20, 30, 40])).toBe(62.5);
  });

  describe("calculateNormalizedUnderratedScore", () => {
    it("returns 0 when strength has no signal", () => {
      expect(calculateNormalizedUnderratedScore(0, 100, 5)).toBe(0);
      expect(calculateNormalizedUnderratedScore(10, 0, 5)).toBe(0);
    });

    it("tính điểm tương quan chất lượng vs độ phủ (Quality vs Traffic)", () => {
      // maxSI = 100, store SI = 10 (low traffic), rating = 5.0 (quality = 1.0)
      // us = 1.0 * (1 - 10/100) = 0.9
      const us = calculateNormalizedUnderratedScore(10, 100, 5.0);
      expect(us).toBe(0.9);
    });

    it("quán chất lượng cao nhưng đã bão hòa tương tác (SI = maxSI) sẽ có điểm US thấp hơn để nhường chỗ cho hidden gems", () => {
      const us = calculateNormalizedUnderratedScore(100, 100, 5.0);
      expect(us).toBe(0);
    });

    it("ưu tiên chất lượng cao hơn khi mức độ phủ tương đương", () => {
      const highQuality = calculateNormalizedUnderratedScore(10, 100, 5);
      const lowQuality = calculateNormalizedUnderratedScore(10, 100, 4);
      expect(highQuality).toBeGreaterThan(lowQuality);
    });
  });
});
