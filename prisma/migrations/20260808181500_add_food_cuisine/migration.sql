ALTER TABLE "foods" ADD COLUMN "cuisine" TEXT;

UPDATE "foods" AS food
SET "cuisine" = application_menu."cuisine"
FROM "application_menus" AS application_menu
INNER JOIN "applications" AS application
  ON application."id" = application_menu."applicationId"
INNER JOIN "merchants" AS merchant
  ON merchant."userId" = application."applicantUserId"
WHERE food."merchantId" = merchant."id"
  AND LOWER(TRIM(food."name")) = LOWER(TRIM(application_menu."name"))
  AND application_menu."cuisine" IS NOT NULL
  AND TRIM(application_menu."cuisine") <> '';

UPDATE "foods" AS food
SET "cuisine" = 'Việt Nam'
WHERE EXISTS (
  SELECT 1
  FROM "food_categories" AS food_category
  INNER JOIN "categories" AS category ON category."id" = food_category."categoryId"
  WHERE food_category."foodId" = food."id"
    AND LOWER(REGEXP_REPLACE(category."name", '\s*(UAT|TEST)\s*$', '', 'i')) IN (
      'món việt',
      'vietnamese',
      'vietnamese food'
    )
);

INSERT INTO "categories" ("id", "parentId", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT 'a1000000-0000-4000-8000-000000000001', NULL, 'Món chính', 'Phân loại món ăn chính.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE LOWER(REGEXP_REPLACE("name", '\s*(UAT|TEST)\s*$', '', 'i')) IN ('món chính', 'main dish', 'main course')
);

INSERT INTO "categories" ("id", "parentId", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT 'a1000000-0000-4000-8000-000000000002', NULL, 'Món ăn nhẹ', 'Phân loại món ăn nhẹ.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE LOWER(REGEXP_REPLACE("name", '\s*(UAT|TEST)\s*$', '', 'i')) IN ('món ăn nhẹ', 'snack', 'snacks')
);

INSERT INTO "categories" ("id", "parentId", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT 'a1000000-0000-4000-8000-000000000003', NULL, 'Món khai vị', 'Phân loại món khai vị.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE LOWER(REGEXP_REPLACE("name", '\s*(UAT|TEST)\s*$', '', 'i')) IN ('món khai vị', 'appetizer', 'appetizers', 'starter', 'starters')
);

INSERT INTO "categories" ("id", "parentId", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT 'a1000000-0000-4000-8000-000000000004', NULL, 'Món tráng miệng', 'Phân loại món tráng miệng.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE LOWER(REGEXP_REPLACE("name", '\s*(UAT|TEST)\s*$', '', 'i')) IN ('món tráng miệng', 'dessert', 'desserts')
);

INSERT INTO "categories" ("id", "parentId", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT 'a1000000-0000-4000-8000-000000000005', NULL, 'Đồ uống', 'Phân loại đồ uống.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE LOWER(REGEXP_REPLACE("name", '\s*(UAT|TEST)\s*$', '', 'i')) IN ('đồ uống', 'drink', 'drinks', 'beverage', 'beverages')
);
