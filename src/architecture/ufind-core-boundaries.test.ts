import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("UFind core boundaries", () => {
  it("merchant scoring does not depend on commerce", () => {
    const scoreSource = source("src/common/utils/merchant-score.ts");

    expect(scoreSource).not.toMatch(/\border(s)?\b/i);
    expect(scoreSource).not.toMatch(/\bpayment(s)?\b/i);
    expect(scoreSource).not.toMatch(/\baffiliate\b/i);
    expect(scoreSource).not.toMatch(/\bcampaign\b/i);
    expect(scoreSource).not.toMatch(/\bsponsored\b/i);
    expect(scoreSource).not.toMatch(/boostBonus/i);
  });

  it("rebalancing does not depend on commerce", () => {
    const rebalancingSource = source(
      "src/modules/rebalancing/rebalancing.service.ts",
    );

    expect(rebalancingSource).not.toMatch(/\border(s)?\b/i);
    expect(rebalancingSource).not.toMatch(/\bpayment(s)?\b/i);
    expect(rebalancingSource).not.toMatch(/\baffiliate\b/i);
    expect(rebalancingSource).not.toMatch(/\bcampaignBonus|boostBonus\b/i);
  });

  it("merchant analytics core is acquisition-led, not order-led", () => {
    const analyticsSource = source(
      "src/common/services/merchant-analytics.service.ts",
    );

    expect(analyticsSource).toMatch(/merchantAcquisitionEvent/);
    expect(analyticsSource).not.toMatch(/\border(s)?\b/i);
    expect(analyticsSource).not.toMatch(/\bpayment(s)?\b/i);
  });

  it("Gem Points core does not depend on commerce", () => {
    const pointsSource = source("src/modules/gem-points/gem-point.service.ts");

    expect(pointsSource).not.toMatch(/\border(s)?\b/i);
    expect(pointsSource).not.toMatch(/\bpayment(s)?\b/i);
    expect(pointsSource).not.toMatch(/\baffiliate\b/i);
  });

  it("does not introduce a Phase 8 destructive migration", () => {
    const migrations = fs
      .readdirSync(path.resolve(process.cwd(), "prisma/migrations"))
      .filter((name) => name.toLowerCase().includes("cleanup"));

    expect(migrations).toEqual([]);
  });
});
