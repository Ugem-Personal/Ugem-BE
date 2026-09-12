import { describe, expect, it } from "vitest";

import {
  calculateNormalizedUnderratedScore,
  calculateStrengthIndex,
  calculateUnderratedScore,
} from "./merchant-score.js";

describe("merchant-score utils", () => {
  describe("calculateStrengthIndex", () => {
    it("tính toán chỉ số SI chuẩn xác theo trọng số Orders, Reviews, Views và CheckIns", () => {
      // SI = 10*0.35 + 4*0.25 + (100/10)*0.25 + 6*0.15 = 3.5 + 1.0 + 2.5 + 0.9 = 7.9
      const si = calculateStrengthIndex(10, 4, 100, 6);
      expect(si).toBe(7.9);
    });

    it("trả về 0 khi tất cả các chỉ số đều bằng 0", () => {
      const si = calculateStrengthIndex(0, 0, 0, 0);
      expect(si).toBe(0);
    });
  });

  describe("calculateUnderratedScore", () => {
    it("tăng điểm tiềm năng (boost 1.15) cho quán rating cao nhưng ít review/view (Hidden Gem)", () => {
      const score = calculateUnderratedScore(4.8, 15, 120);
      // normalizedRating = 4.8 / 5 = 0.96 * 1.15 = 1.104 -> capped at 1.0
      expect(score).toBe(1.0);
    });

    it("giảm độ ưu tiên (penalty 0.85) cho quán đã quá đông khách/nhiều view", () => {
      const score = calculateUnderratedScore(4.5, 250, 3000);
      // normalizedRating = 4.5 / 5 = 0.9 * 0.85 = 0.765 -> 0.77
      expect(score).toBe(0.77);
    });

    it("trả về normalized rating chuẩn khi trong khoảng trung bình", () => {
      const score = calculateUnderratedScore(4.0, 80, 800);
      expect(score).toBe(0.8);
    });
  });

  describe("calculateNormalizedUnderratedScore", () => {
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
  });
});
