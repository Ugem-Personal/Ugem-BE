-- Persist all fields used by the frontend campaign contract.
ALTER TABLE "campaigns"
ADD COLUMN "code" TEXT,
ADD COLUMN "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isNewUserOnly" BOOLEAN NOT NULL DEFAULT false;

-- Existing campaigns used their id as the compatibility code.
UPDATE "campaigns" SET "code" = "id" WHERE "code" IS NULL;
ALTER TABLE "campaigns" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "campaigns_code_key" ON "campaigns"("code");

-- Reviewer loyalty state and its audit history.
ALTER TABLE "customers"
ADD COLUMN "reviewerPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reviewerRank" TEXT NOT NULL DEFAULT 'Bronze';

UPDATE "customers" AS customer
SET "reviewerPoints" =
  COALESCE((
    SELECT SUM(link."clickCount" + link."successfulOrders" * 100)
    FROM "affiliate_links" AS link
    WHERE link."reviewerId" = customer."id"
  ), 0),
  "reviewerRank" = CASE
    WHEN COALESCE((SELECT SUM(link."successfulOrders") FROM "affiliate_links" AS link WHERE link."reviewerId" = customer."id"), 0) >= 100 THEN 'Diamond'
    WHEN COALESCE((SELECT SUM(link."successfulOrders") FROM "affiliate_links" AS link WHERE link."reviewerId" = customer."id"), 0) >= 50 THEN 'Platinum'
    WHEN COALESCE((SELECT SUM(link."successfulOrders") FROM "affiliate_links" AS link WHERE link."reviewerId" = customer."id"), 0) >= 20 THEN 'Gold'
    WHEN COALESCE((SELECT SUM(link."successfulOrders") FROM "affiliate_links" AS link WHERE link."reviewerId" = customer."id"), 0) >= 5 THEN 'Silver'
    ELSE 'Bronze'
  END;

CREATE TABLE "reviewer_point_transactions" (
  "id" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "pointsAfter" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviewer_point_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reviewer_point_transactions_reviewerId_idx" ON "reviewer_point_transactions"("reviewerId");
CREATE INDEX "reviewer_point_transactions_createdAt_idx" ON "reviewer_point_transactions"("createdAt");
ALTER TABLE "reviewer_point_transactions" ADD CONSTRAINT "reviewer_point_transactions_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A check-in is an auditable, one-time action independent from order status.
CREATE TABLE "check_ins" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "qrToken" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedInAt" TIMESTAMP(3),

  CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "check_ins_orderId_key" ON "check_ins"("orderId");
CREATE UNIQUE INDEX "check_ins_qrToken_key" ON "check_ins"("qrToken");
CREATE INDEX "check_ins_customerId_idx" ON "check_ins"("customerId");
CREATE INDEX "check_ins_merchantId_idx" ON "check_ins"("merchantId");
CREATE INDEX "check_ins_checkedInAt_idx" ON "check_ins"("checkedInAt");

ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
