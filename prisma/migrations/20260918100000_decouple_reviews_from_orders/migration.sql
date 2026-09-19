ALTER TABLE "reviews" ADD COLUMN "checkInId" TEXT;
ALTER TABLE "reviews" ALTER COLUMN "orderId" DROP NOT NULL;

UPDATE "reviews" r
SET "checkInId" = c."id"
FROM "check_ins" c
WHERE r."orderId" IS NOT NULL
  AND c."orderId" = r."orderId"
  AND r."checkInId" IS NULL;

CREATE UNIQUE INDEX "reviews_checkInId_key" ON "reviews"("checkInId");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "check_ins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
