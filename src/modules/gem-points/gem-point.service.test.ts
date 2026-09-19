import { describe, expect, it, vi } from "vitest";

import { GEM_POINT_TRANSACTION_TYPE } from "../../common/constants/gem-point-transaction.js";
import { calculateContributionRank } from "../../common/utils/contribution-rank.js";
import { awardGemPoints } from "./gem-point.service.js";

const createTransaction = (options: {
  initialGemPoints?: number;
  claimCount?: number;
} = {}) => {
  let points = options.initialGemPoints ?? 0;
  const createMany = vi.fn().mockResolvedValue({
    count: options.claimCount ?? 1,
  });
  const updateLedger = vi.fn().mockResolvedValue({});
  const updateCustomer = vi.fn().mockImplementation(({ data }: any) => {
    if (data.gemPoints?.increment) {
      points += data.gemPoints.increment;
      return Promise.resolve({ gemPoints: points });
    }

    return Promise.resolve({ gemPoints: points });
  });

  return {
    transaction: {
      customer: { update: updateCustomer },
      reviewerPointTransaction: {
        createMany,
        update: updateLedger,
      },
    } as any,
    createMany,
    updateLedger,
    updateCustomer,
  };
};

describe("Gem Point service", () => {
  it("awards 10 points for a Verified Visit", async () => {
    const { transaction, createMany, updateCustomer } = createTransaction();

    const result = await awardGemPoints(transaction, {
      customerId: "customer-1",
      action: "VERIFIED_VISIT",
      referenceId: "check-in-1",
    });

    expect(result).toMatchObject({
      awarded: true,
      amount: 10,
      pointsAfter: 10,
      contributionRank: "Bronze",
    });
    expect(updateCustomer).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { gemPoints: { increment: 10 } },
      select: { gemPoints: true },
    }));
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        type: GEM_POINT_TRANSACTION_TYPE.VERIFIED_VISIT,
        rewardKey: "customer-1:GEM_VERIFIED_VISIT:check-in-1",
      })],
      skipDuplicates: true,
    });
  });

  it("awards 15 points for a Verified Review", async () => {
    const { transaction } = createTransaction();
    const result = await awardGemPoints(transaction, {
      customerId: "customer-1",
      action: "VERIFIED_REVIEW",
      referenceId: "review-1",
    });

    expect(result.amount).toBe(15);
  });

  it("awards 20 points for a Verified Review with an image", async () => {
    const { transaction } = createTransaction();
    const result = await awardGemPoints(transaction, {
      customerId: "customer-1",
      action: "VERIFIED_REVIEW_WITH_IMAGE",
      referenceId: "review-1",
    });

    expect(result.amount).toBe(20);
  });

  it("does not award a replayed CheckIn or Review", async () => {
    const { transaction, updateCustomer, updateLedger } = createTransaction({
      claimCount: 0,
    });

    const result = await awardGemPoints(transaction, {
      customerId: "customer-1",
      action: "VERIFIED_VISIT",
      referenceId: "check-in-1",
    });

    expect(result).toMatchObject({
      awarded: false,
      amount: 0,
      pointsAfter: 0,
      contributionRank: null,
    });
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(updateLedger).not.toHaveBeenCalled();
  });

  it("does not vary reward by review rating", async () => {
    const oneStar = await awardGemPoints(createTransaction().transaction, {
      customerId: "customer-1",
      action: "VERIFIED_REVIEW",
      referenceId: "review-1",
    });
    const fiveStar = await awardGemPoints(createTransaction().transaction, {
      customerId: "customer-1",
      action: "VERIFIED_REVIEW",
      referenceId: "review-2",
    });

    expect(oneStar.amount).toBe(fiveStar.amount);
    expect(oneStar.amount).toBe(15);
  });

  it.each([
    [0, "Bronze"],
    [99, "Bronze"],
    [100, "Silver"],
    [249, "Silver"],
    [250, "Gold"],
    [499, "Gold"],
    [500, "Platinum"],
    [999, "Platinum"],
    [1000, "Diamond"],
  ])("calculates contribution rank at %i points", (points, rank) => {
    expect(calculateContributionRank(points)).toBe(rank);
  });
});
