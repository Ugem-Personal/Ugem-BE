-- AlterTable
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "isCombo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(12,2);
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "servingSize" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "combo_items" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "combo_items_comboId_idx" ON "combo_items"("comboId");
CREATE INDEX IF NOT EXISTS "combo_items_foodId_idx" ON "combo_items"("foodId");
CREATE UNIQUE INDEX IF NOT EXISTS "combo_items_comboId_foodId_key" ON "combo_items"("comboId", "foodId");
CREATE INDEX IF NOT EXISTS "foods_isCombo_idx" ON "foods"("isCombo");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combo_items_comboId_fkey') THEN
        ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combo_items_foodId_fkey') THEN
        ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;