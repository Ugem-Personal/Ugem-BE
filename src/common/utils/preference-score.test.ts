import { describe, expect, it } from "vitest";

import { calculatePreferenceScore } from "./preference-score.js";

const merchant = {
  restaurantType: "Nhà hàng nhỏ",
  mainDishType: "Ăn vặt",
  priceRange: "Bình dân",
  categoryIds: ["snack-category", "drink-category"],
};

describe("calculatePreferenceScore", () => {
  it("ưu tiên category thực tế trong menu", () => {
    const result = calculatePreferenceScore(
      {
        preferredRestaurantTypes: [],
        preferredMainDishTypes: ["Bún"],
        preferredCategoryIds: ["snack-category"],
        preferredPriceRanges: [],
      },
      merchant,
    );

    expect(result).toEqual({ hasPreferences: true, score: 100 });
  });

  it("chuẩn hóa trọng số theo các nhóm người dùng đã chọn", () => {
    const result = calculatePreferenceScore(
      {
        preferredRestaurantTypes: ["Nhà hàng nhỏ"],
        preferredMainDishTypes: [],
        preferredCategoryIds: ["missing-category"],
        preferredPriceRanges: ["Bình dân"],
      },
      merchant,
    );

    expect(result.hasPreferences).toBe(true);
    expect(result.score).toBe(50);
  });

  it("fallback về món chủ đạo cho preference cũ", () => {
    const result = calculatePreferenceScore(
      {
        preferredRestaurantTypes: [],
        preferredMainDishTypes: ["Ăn vặt"],
        preferredCategoryIds: [],
        preferredPriceRanges: [],
      },
      merchant,
    );

    expect(result.score).toBe(100);
  });
});
