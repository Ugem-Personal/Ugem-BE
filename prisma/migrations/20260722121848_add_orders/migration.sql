-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('Online', 'Offline');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'Cash', 'BankTransfer', 'SePay');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Pending', 'Accepted', 'Rejected', 'Completed', 'NotReceived', 'Cancelled');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "deliveryAddress" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "rejectionReason" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_details" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "foodNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_detail_toppings" (
    "id" TEXT NOT NULL,
    "orderDetailId" TEXT NOT NULL,
    "toppingId" TEXT NOT NULL,
    "toppingNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_detail_toppings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_merchantId_idx" ON "orders"("merchantId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_orderedAt_idx" ON "orders"("orderedAt");

-- CreateIndex
CREATE INDEX "order_details_orderId_idx" ON "order_details"("orderId");

-- CreateIndex
CREATE INDEX "order_details_foodId_idx" ON "order_details"("foodId");

-- CreateIndex
CREATE INDEX "order_detail_toppings_orderDetailId_idx" ON "order_detail_toppings"("orderDetailId");

-- CreateIndex
CREATE INDEX "order_detail_toppings_toppingId_idx" ON "order_detail_toppings"("toppingId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_details" ADD CONSTRAINT "order_details_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_detail_toppings" ADD CONSTRAINT "order_detail_toppings_orderDetailId_fkey" FOREIGN KEY ("orderDetailId") REFERENCES "order_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_detail_toppings" ADD CONSTRAINT "order_detail_toppings_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "food_toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
