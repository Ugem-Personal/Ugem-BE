-- Ensure all enums exist
DO $$ BEGIN
    CREATE TYPE "BookingStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Cancelled', 'Completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MerchantTrafficSource" AS ENUM ('Recommendation', 'Search', 'Map', 'Affiliate', 'Direct');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AffiliateTransactionStatus" AS ENUM ('Pending', 'Failed', 'Success', 'Commissioned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RebalancingStatus" AS ENUM ('Running', 'Completed', 'Failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SupportTicketStatus" AS ENUM ('Open', 'InProgress', 'WaitingForMerchant', 'Resolved', 'Closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SupportTicketPriority" AS ENUM ('Low', 'Normal', 'High', 'Urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SupportTicketCategory" AS ENUM ('Orders', 'Delivery', 'Payment', 'Menu', 'Account', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CheckInStatus" AS ENUM ('Pending', 'Verified', 'Rejected', 'Expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Align customers columns
ALTER TABLE "customers"
ADD COLUMN IF NOT EXISTS "preferredRestaurantTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "preferredMainDishTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "preferredCategoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "preferredPriceRanges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Align check_ins columns and indexes
ALTER TABLE "check_ins"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
ADD COLUMN IF NOT EXISTS "status" "CheckInStatus" NOT NULL DEFAULT 'Pending';

CREATE INDEX IF NOT EXISTS "check_ins_status_idx" ON "check_ins"("status");

-- Align merchants columns and indexes
ALTER TABLE "merchants"
ADD COLUMN IF NOT EXISTS "strengthIndex" DECIMAL(10,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "underratedScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "recommendationRank" INTEGER,
ADD COLUMN IF NOT EXISTS "lastRebalancedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "merchants_recommendationRank_idx" ON "merchants"("recommendationRank");
CREATE INDEX IF NOT EXISTS "merchants_underratedScore_idx" ON "merchants"("underratedScore");
CREATE INDEX IF NOT EXISTS "merchants_latitude_longitude_idx" ON "merchants"("latitude", "longitude");

-- Create rebalancing_runs table
CREATE TABLE IF NOT EXISTS "rebalancing_runs" (
    "id" TEXT NOT NULL,
    "status" "RebalancingStatus" NOT NULL DEFAULT 'Running',
    "merchantCount" INTEGER NOT NULL DEFAULT 0,
    "increasedVisibility" INTEGER NOT NULL DEFAULT 0,
    "decreasedVisibility" INTEGER NOT NULL DEFAULT 0,
    "unchangedVisibility" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "rebalancing_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rebalancing_runs_startedAt_idx" ON "rebalancing_runs"("startedAt");
CREATE INDEX IF NOT EXISTS "rebalancing_runs_status_idx" ON "rebalancing_runs"("status");

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assignedStaffId" TEXT,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'Other',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'Normal',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'Open',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_merchantId_fkey') THEN
        ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_createdByUserId_fkey') THEN
        ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_assignedStaffId_fkey') THEN
        ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_ticketId_fkey') THEN
        ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_senderUserId_fkey') THEN
        ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "support_tickets_merchantId_status_idx" ON "support_tickets"("merchantId", "status");
CREATE INDEX IF NOT EXISTS "support_tickets_assignedStaffId_status_idx" ON "support_tickets"("assignedStaffId", "status");
CREATE INDEX IF NOT EXISTS "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");
CREATE INDEX IF NOT EXISTS "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "support_messages_senderUserId_idx" ON "support_messages"("senderUserId");

-- Create bookings table
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "affiliateLinkId" TEXT,
    "bookingAt" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL,
    "note" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'Pending',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- Create merchant_views table
CREATE TABLE IF NOT EXISTS "merchant_views" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "source" "MerchantTrafficSource" NOT NULL DEFAULT 'Direct',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_views_pkey" PRIMARY KEY ("id")
);

-- Foreign keys and indexes for bookings and merchant_views
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customerId_fkey') THEN
        ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_merchantId_fkey') THEN
        ALTER TABLE "bookings" ADD CONSTRAINT "bookings_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_affiliateLinkId_fkey') THEN
        ALTER TABLE "bookings" ADD CONSTRAINT "bookings_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_views_merchantId_fkey') THEN
        ALTER TABLE "merchant_views" ADD CONSTRAINT "merchant_views_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_views_customerId_fkey') THEN
        ALTER TABLE "merchant_views" ADD CONSTRAINT "merchant_views_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bookings_customerId_idx" ON "bookings"("customerId");
CREATE INDEX IF NOT EXISTS "bookings_merchantId_idx" ON "bookings"("merchantId");
CREATE INDEX IF NOT EXISTS "bookings_affiliateLinkId_idx" ON "bookings"("affiliateLinkId");
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings"("status");
CREATE INDEX IF NOT EXISTS "merchant_views_merchantId_idx" ON "merchant_views"("merchantId");
CREATE INDEX IF NOT EXISTS "merchant_views_customerId_idx" ON "merchant_views"("customerId");
CREATE INDEX IF NOT EXISTS "merchant_views_source_idx" ON "merchant_views"("source");
CREATE INDEX IF NOT EXISTS "merchant_views_createdAt_idx" ON "merchant_views"("createdAt");

-- Create affiliate_transactions table
CREATE TABLE IF NOT EXISTS "affiliate_transactions" (
    "id" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "status" "AffiliateTransactionStatus" NOT NULL DEFAULT 'Pending',
    "commission" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_transactions_pkey" PRIMARY KEY ("id")
);

-- Alter reviewer_earning_transactions orderId and bookingId
DO $$ BEGIN
    ALTER TABLE "reviewer_earning_transactions" ALTER COLUMN "orderId" DROP NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

ALTER TABLE "reviewer_earning_transactions" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

-- Foreign keys and indexes for affiliate_transactions and reviewer_earning_transactions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_transactions_affiliateLinkId_fkey') THEN
        ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_transactions_orderId_fkey') THEN
        ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_transactions_bookingId_fkey') THEN
        ALTER TABLE "affiliate_transactions" ADD CONSTRAINT "affiliate_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviewer_earning_transactions_bookingId_fkey') THEN
        ALTER TABLE "reviewer_earning_transactions" ADD CONSTRAINT "reviewer_earning_transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "affiliate_transactions_affiliateLinkId_idx" ON "affiliate_transactions"("affiliateLinkId");
CREATE INDEX IF NOT EXISTS "affiliate_transactions_status_idx" ON "affiliate_transactions"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_transactions_orderId_key" ON "affiliate_transactions"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_transactions_bookingId_key" ON "affiliate_transactions"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_earning_transactions_bookingId_key" ON "reviewer_earning_transactions"("bookingId");
