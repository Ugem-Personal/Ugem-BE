-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('Unpaid', 'Pending', 'Paid', 'Rejected');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('Requested', 'PendingCustomerConfirmation', 'Confirmed', 'Rejected');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'Unpaid';

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "BillStatus" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "evidenceUrl" TEXT,
    "transferContent" TEXT,
    "sepayReference" TEXT,
    "requestedAt" TIMESTAMP(3),
    "merchantConfirmedAt" TIMESTAMP(3),
    "customerConfirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bills_orderId_key" ON "bills"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_sepayReference_key" ON "bills"("sepayReference");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE INDEX "bills_createdAt_idx" ON "bills"("createdAt");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
