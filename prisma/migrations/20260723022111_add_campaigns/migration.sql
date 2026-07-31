-- CreateEnum
CREATE TYPE "CampaignDiscountType" AS ENUM ('Percentage', 'FixedAmount');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CampaignDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minimumOrderAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maximumDiscount" DECIMAL(12,2),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_merchantId_idx" ON "campaigns"("merchantId");

-- CreateIndex
CREATE INDEX "campaigns_isActive_idx" ON "campaigns"("isActive");

-- CreateIndex
CREATE INDEX "campaigns_startAt_idx" ON "campaigns"("startAt");

-- CreateIndex
CREATE INDEX "campaigns_endAt_idx" ON "campaigns"("endAt");

-- CreateIndex
CREATE INDEX "orders_campaignId_idx" ON "orders"("campaignId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
