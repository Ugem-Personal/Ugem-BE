ALTER TABLE "customers"
ADD COLUMN "preferredCategoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
