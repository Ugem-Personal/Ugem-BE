export type ContributionRank =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond";

export const calculateContributionRank = (
  points: number,
): ContributionRank => {
  if (points >= 1000) return "Diamond";
  if (points >= 500) return "Platinum";
  if (points >= 250) return "Gold";
  if (points >= 100) return "Silver";
  return "Bronze";
};
