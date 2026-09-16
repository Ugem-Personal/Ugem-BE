DO $$ BEGIN
  CREATE TYPE "CheckInMethod" AS ENUM ('OrderQr', 'CustomerCode');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "CheckInStatus" ADD VALUE IF NOT EXISTS 'Disputed';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantVerificationStatus" AS ENUM ('Unverified', 'PendingVerification', 'VerifiedBusiness', 'UnderReview', 'Suspended', 'Removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MerchantListingVisibility" AS ENUM ('Public', 'Hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "verificationStatus" "MerchantVerificationStatus" NOT NULL DEFAULT 'Unverified',
  ADD COLUMN IF NOT EXISTS "listingVisibility" "MerchantListingVisibility" NOT NULL DEFAULT 'Public';

ALTER TABLE "check_ins"
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "campaignId" TEXT,
  ADD COLUMN IF NOT EXISTS "bookingId" TEXT,
  ADD COLUMN IF NOT EXISTS "affiliateLinkId" TEXT,
  ADD COLUMN IF NOT EXISTS "checkInMethod" "CheckInMethod" NOT NULL DEFAULT 'OrderQr',
  ADD COLUMN IF NOT EXISTS "suspicious" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "suspiciousReason" TEXT,
  ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "merchant_acquisition_events" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "checkInId" TEXT NOT NULL,
  "campaignId" TEXT,
  "orderId" TEXT,
  "bookingId" TEXT,
  "affiliateLinkId" TEXT,
  "source" TEXT,
  "verificationMethod" "CheckInMethod" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_acquisition_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_acquisition_events_checkInId_key"
  ON "merchant_acquisition_events"("checkInId");
CREATE INDEX IF NOT EXISTS "merchant_acquisition_events_merchantId_occurredAt_idx"
  ON "merchant_acquisition_events"("merchantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "merchant_acquisition_events_customerId_occurredAt_idx"
  ON "merchant_acquisition_events"("customerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "merchant_acquisition_events_source_idx"
  ON "merchant_acquisition_events"("source");
CREATE INDEX IF NOT EXISTS "check_ins_merchantId_customerId_checkedInAt_idx"
  ON "check_ins"("merchantId", "customerId", "checkedInAt");
CREATE INDEX IF NOT EXISTS "check_ins_suspicious_status_idx"
  ON "check_ins"("suspicious", "status");

DO $$ BEGIN
  ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_affiliateLinkId_fkey"
    FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_checkInId_fkey"
    FOREIGN KEY ("checkInId") REFERENCES "check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "merchant_acquisition_events" ADD CONSTRAINT "merchant_acquisition_events_affiliateLinkId_fkey"
    FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
