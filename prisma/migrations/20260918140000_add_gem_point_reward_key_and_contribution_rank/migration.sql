ALTER TABLE "customers"
ADD COLUMN "contributionRank" TEXT NOT NULL DEFAULT 'Bronze';

ALTER TABLE "reviewer_point_transactions"
ADD COLUMN "rewardKey" TEXT;

CREATE UNIQUE INDEX "reviewer_point_transactions_rewardKey_key"
ON "reviewer_point_transactions"("rewardKey");
