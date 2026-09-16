ALTER TABLE "merchants"
  ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'VN',
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "area" TEXT;
CREATE INDEX IF NOT EXISTS "merchants_country_city_area_idx" ON "merchants"("country","city","area");
