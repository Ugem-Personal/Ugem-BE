-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Draft', 'Pending', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('Merchant');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL DEFAULT 'Merchant',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Pending',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "restaurantType" TEXT NOT NULL,
    "mainDishType" TEXT NOT NULL,
    "priceRange" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "logoUrl" TEXT,
    "openingHours" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_menus" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_applicantUserId_idx" ON "applications"("applicantUserId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "application_menus_applicationId_idx" ON "application_menus"("applicationId");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_menus" ADD CONSTRAINT "application_menus_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
