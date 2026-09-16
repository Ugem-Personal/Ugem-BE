CREATE TYPE "MerchantAcquisitionEventStatus" AS ENUM ('Valid', 'Disputed', 'Cancelled');

ALTER TABLE "merchant_acquisition_events"
  ADD COLUMN IF NOT EXISTS "status" "MerchantAcquisitionEventStatus" NOT NULL DEFAULT 'Valid';

CREATE INDEX IF NOT EXISTS "merchant_acquisition_events_merchantId_status_occurredAt_idx"
  ON "merchant_acquisition_events"("merchantId", "status", "occurredAt");
