DO $$ BEGIN CREATE TYPE "IncidentType" AS ENUM ('FoodSafety','Hygiene','Fraud','WrongInformation','BadService','Other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IncidentSeverity" AS ENUM ('Low','Medium','High','Critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IncidentStatus" AS ENUM ('Open','UnderReview','Resolved','Rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MerchantClaimStatus" AS ENUM ('Pending','UnderReview','Approved','Rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MerchantRemovalStatus" AS ENUM ('Pending','UnderReview','Approved','Rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RestaurantSuggestionStatus" AS ENUM ('Pending','UnderReview','Approved','Rejected','Published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FunnelEventType" AS ENUM ('Register','ActiveUser','RestaurantView','Save','Visit','CheckIn','VerifiedVisit','RepeatVisit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MonetizationFeeType" AS ENUM ('VerifiedVisitFee','CampaignFee','PremiumAnalytics','OptionalOrderFee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "safetySuppressed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "safetySuppressedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "safetyRiskScore" DECIMAL(10,4) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "merchants_verificationStatus_idx" ON "merchants"("verificationStatus");
CREATE INDEX IF NOT EXISTS "merchants_listingVisibility_idx" ON "merchants"("listingVisibility");
CREATE INDEX IF NOT EXISTS "merchants_safetySuppressed_idx" ON "merchants"("safetySuppressed");

CREATE TABLE IF NOT EXISTS "merchant_incidents" (
  "id" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "reporterUserId" TEXT NOT NULL,
  "type" "IncidentType" NOT NULL, "severity" "IncidentSeverity" NOT NULL DEFAULT 'Medium',
  "status" "IncidentStatus" NOT NULL DEFAULT 'Open', "description" TEXT NOT NULL,
  "evidenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "adminDecision" TEXT,
  "resolution" TEXT, "reviewedByUserId" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_incidents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "merchant_incidents_merchantId_status_idx" ON "merchant_incidents"("merchantId","status");
CREATE INDEX IF NOT EXISTS "merchant_incidents_merchantId_severity_createdAt_idx" ON "merchant_incidents"("merchantId","severity","createdAt");
CREATE INDEX IF NOT EXISTS "merchant_incidents_reporterUserId_idx" ON "merchant_incidents"("reporterUserId");

CREATE TABLE IF NOT EXISTS "merchant_claims" (
  "id" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "submittedByUserId" TEXT NOT NULL,
  "status" "MerchantClaimStatus" NOT NULL DEFAULT 'Pending', "evidenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "decision" TEXT, "reviewedByUserId" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "merchant_claims_merchantId_status_idx" ON "merchant_claims"("merchantId","status");
CREATE INDEX IF NOT EXISTS "merchant_claims_submittedByUserId_idx" ON "merchant_claims"("submittedByUserId");

CREATE TABLE IF NOT EXISTS "merchant_removal_requests" (
  "id" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "submittedByUserId" TEXT NOT NULL,
  "status" "MerchantRemovalStatus" NOT NULL DEFAULT 'Pending', "reason" TEXT NOT NULL,
  "decision" TEXT, "reviewedByUserId" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_removal_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "merchant_removal_requests_merchantId_status_idx" ON "merchant_removal_requests"("merchantId","status");
CREATE INDEX IF NOT EXISTS "merchant_removal_requests_submittedByUserId_idx" ON "merchant_removal_requests"("submittedByUserId");

CREATE TABLE IF NOT EXISTS "restaurant_suggestions" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT NOT NULL, "category" TEXT,
  "recommendedDish" TEXT, "description" TEXT, "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT NOT NULL, "submittedByUserId" TEXT, "status" "RestaurantSuggestionStatus" NOT NULL DEFAULT 'Pending',
  "reviewedByUserId" TEXT, "publishedMerchantId" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restaurant_suggestions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "restaurant_suggestions_status_createdAt_idx" ON "restaurant_suggestions"("status","createdAt");
CREATE INDEX IF NOT EXISTS "restaurant_suggestions_submittedByUserId_idx" ON "restaurant_suggestions"("submittedByUserId");

CREATE TABLE IF NOT EXISTS "funnel_events" (
  "id" TEXT NOT NULL, "eventType" "FunnelEventType" NOT NULL, "userId" TEXT,
  "merchantId" TEXT, "sessionKey" TEXT, "metadata" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "funnel_events_eventType_occurredAt_idx" ON "funnel_events"("eventType","occurredAt");
CREATE INDEX IF NOT EXISTS "funnel_events_merchantId_eventType_occurredAt_idx" ON "funnel_events"("merchantId","eventType","occurredAt");
CREATE INDEX IF NOT EXISTS "funnel_events_userId_eventType_occurredAt_idx" ON "funnel_events"("userId","eventType","occurredAt");

CREATE TABLE IF NOT EXISTS "monetization_fee_policies" (
  "id" TEXT NOT NULL, "feeType" "MonetizationFeeType" NOT NULL, "amount" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'VND', "isActive" BOOLEAN NOT NULL DEFAULT false,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monetization_fee_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "monetization_fee_policies_feeType_isActive_idx" ON "monetization_fee_policies"("feeType","isActive");
