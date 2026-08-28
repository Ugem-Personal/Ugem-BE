-- Keep booking affiliate relations aligned with the Prisma schema.
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "affiliateLinkId" TEXT;

ALTER TABLE "affiliate_transactions"
ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

ALTER TABLE "reviewer_earning_transactions"
ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

CREATE INDEX IF NOT EXISTS "bookings_affiliateLinkId_idx"
ON "bookings"("affiliateLinkId");

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_transactions_bookingId_key"
ON "affiliate_transactions"("bookingId");

CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_earning_transactions_bookingId_key"
ON "reviewer_earning_transactions"("bookingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_affiliateLinkId_fkey'
  ) THEN
    ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_affiliateLinkId_fkey"
    FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_transactions_bookingId_fkey'
  ) THEN
    ALTER TABLE "affiliate_transactions"
    ADD CONSTRAINT "affiliate_transactions_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviewer_earning_transactions_bookingId_fkey'
  ) THEN
    ALTER TABLE "reviewer_earning_transactions"
    ADD CONSTRAINT "reviewer_earning_transactions_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
