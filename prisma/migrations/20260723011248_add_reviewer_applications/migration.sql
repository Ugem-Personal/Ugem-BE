-- CreateEnum
CREATE TYPE "ReviewerApplicationStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- CreateTable
CREATE TABLE "reviewer_applications" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ReviewerApplicationStatus" NOT NULL DEFAULT 'Pending',
    "motivation" TEXT NOT NULL,
    "experience" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviewer_applications_customerId_idx" ON "reviewer_applications"("customerId");

-- CreateIndex
CREATE INDEX "reviewer_applications_status_idx" ON "reviewer_applications"("status");

-- AddForeignKey
ALTER TABLE "reviewer_applications" ADD CONSTRAINT "reviewer_applications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
