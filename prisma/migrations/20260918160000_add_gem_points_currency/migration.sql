ALTER TABLE "customers"
ADD COLUMN "gemPoints" INTEGER NOT NULL DEFAULT 0;

UPDATE "customers" AS customer
SET "gemPoints" = COALESCE((
  SELECT SUM(transaction."amount")::integer
  FROM "reviewer_point_transactions" AS transaction
  WHERE transaction."reviewerId" = customer."id"
    AND transaction."type" IN (
      'GEM_VERIFIED_VISIT',
      'GEM_VERIFIED_REVIEW',
      'GEM_VERIFIED_REVIEW_WITH_IMAGE'
    )
), 0);

UPDATE "customers"
SET "contributionRank" = CASE
  WHEN "gemPoints" >= 1000 THEN 'Diamond'
  WHEN "gemPoints" >= 500 THEN 'Platinum'
  WHEN "gemPoints" >= 250 THEN 'Gold'
  WHEN "gemPoints" >= 100 THEN 'Silver'
  ELSE 'Bronze'
END;
