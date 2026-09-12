-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "customerCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "customers_customerCode_key" ON "customers"("customerCode");
CREATE INDEX IF NOT EXISTS "customers_customerCode_idx" ON "customers"("customerCode");

-- AlterTable
ALTER TABLE "check_ins" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "check_ins" ALTER COLUMN "qrToken" DROP NOT NULL;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "rewardBenefit" TEXT;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "notes" TEXT;
