import { describe, expect, it } from "vitest";

import {
  calculateOrganicRecommendationScore,
  calculateNormalizedUnderratedScore,
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
    expect(determineGemStatus({ rating: 4.5, verifiedReviews: 3, verifiedVisits: 3, exposure: 10 })).toBe("HiddenGem");
    expect(determineGemStatus({ rating: 4.5, verifiedReviews: 3, verifiedVisits: 3, exposure: 30 })).toBe("RisingGem");
    expect(determineGemStatus({ rating: 4.5, verifiedReviews: 3, verifiedVisits: 3, exposure: 70 })).toBe("HallOfFame");
    expect(determineGemStatus({ rating: 3, verifiedReviews: 0, verifiedVisits: 1, exposure: 1 })).toBeNull();
  });

  it("keeps gem classification deterministic for the same organic signals", () => {
    const organic = determineGemStatus({ rating: 4.5, verifiedReviews: 3, verifiedVisits: 3, exposure: 10 });
    const sponsored = determineGemStatus({ rating: 4.5, verifiedReviews: 3, verifiedVisits: 3, exposure: 10 });
    expect(sponsored).toBe(organic);
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
