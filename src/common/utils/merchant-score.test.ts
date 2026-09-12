import { describe, expect, it } from "vitest";

import {
  calculateNormalizedUnderratedScore,
  calculateStrengthIndex,
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
