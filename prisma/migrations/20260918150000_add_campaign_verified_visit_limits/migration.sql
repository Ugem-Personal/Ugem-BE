ALTER TABLE "campaigns"
ADD COLUMN "verifiedVisitLimit" INTEGER;

ALTER TABLE "campaigns"
ADD COLUMN "maxVerifiedVisitsPerCustomer" INTEGER NOT NULL DEFAULT 1;
