import { describe, expect, it } from "vitest";

import { matchesAnyPreference } from "./preference-match.js";

describe("matchesAnyPreference", () => {
  it.each([
    [["Nhà hàng"], "Nhà hàng nhỏ"],
    [["Bún"], "Phở / Bún / Mì"],
    [["Trung bình"], "Tầm trung"],
    [["BÌNH DÂN"], "Bình dân"],
  ])("matches %j with %s", (preferences, merchantValue) => {
    expect(matchesAnyPreference(preferences, merchantValue)).toBe(true);
  });

  it("does not match unrelated values", () => {
    expect(matchesAnyPreference(["Cơm"], "Phở / Bún / Mì")).toBe(false);
  });
});
