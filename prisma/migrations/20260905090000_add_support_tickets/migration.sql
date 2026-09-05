CREATE TYPE "SupportTicketStatus" AS ENUM ('Open', 'InProgress', 'WaitingForMerchant', 'Resolved', 'Closed');
CREATE TYPE "SupportTicketPriority" AS ENUM ('Low', 'Normal', 'High', 'Urgent');
CREATE TYPE "SupportTicketCategory" AS ENUM ('Orders', 'Delivery', 'Payment', 'Menu', 'Account', 'Other');

CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assignedStaffId" TEXT,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'Other',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'Normal',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'Open',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_merchantId_status_idx" ON "support_tickets"("merchantId", "status");
CREATE INDEX "support_tickets_assignedStaffId_status_idx" ON "support_tickets"("assignedStaffId", "status");
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");
CREATE INDEX "support_messages_senderUserId_idx" ON "support_messages"("senderUserId");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_assignedStaffId_fkey"
FOREIGN KEY ("assignedStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_messages"
ADD CONSTRAINT "support_messages_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages"
ADD CONSTRAINT "support_messages_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
