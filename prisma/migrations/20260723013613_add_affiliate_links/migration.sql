-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "affiliateLinkId" TEXT,
ADD COLUMN     "reviewerCommission" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "linkCode" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "successfulOrders" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "customerId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_earning_transactions" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "earningsAfter" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_earning_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_linkCode_key" ON "affiliate_links"("linkCode");

-- CreateIndex
CREATE INDEX "affiliate_links_reviewerId_idx" ON "affiliate_links"("reviewerId");

-- CreateIndex
CREATE INDEX "affiliate_links_merchantId_idx" ON "affiliate_links"("merchantId");

-- CreateIndex
CREATE INDEX "affiliate_links_isActive_idx" ON "affiliate_links"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_reviewerId_merchantId_key" ON "affiliate_links"("reviewerId", "merchantId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateLinkId_idx" ON "affiliate_clicks"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_customerId_idx" ON "affiliate_clicks"("customerId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_clickedAt_idx" ON "affiliate_clicks"("clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_earning_transactions_orderId_key" ON "reviewer_earning_transactions"("orderId");

-- CreateIndex
CREATE INDEX "reviewer_earning_transactions_reviewerId_idx" ON "reviewer_earning_transactions"("reviewerId");

-- CreateIndex
CREATE INDEX "reviewer_earning_transactions_createdAt_idx" ON "reviewer_earning_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "orders_affiliateLinkId_idx" ON "orders"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_earning_transactions" ADD CONSTRAINT "reviewer_earning_transactions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_earning_transactions" ADD CONSTRAINT "reviewer_earning_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
