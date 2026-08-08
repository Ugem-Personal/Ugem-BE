-- Keep the existing category column as the required food type and store
-- cuisine separately because one dish can belong to both dimensions.
ALTER TABLE "application_menus" ADD COLUMN "cuisine" TEXT;
