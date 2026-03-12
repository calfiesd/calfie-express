-- CreateEnum
CREATE TYPE "BatchPurchaseStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BatchPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "BatchPurchaseStatus" NOT NULL,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchPurchase_userId_fingerprint_key" ON "BatchPurchase"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "BatchPurchase_userId_createdAt_idx" ON "BatchPurchase"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BatchPurchase" ADD CONSTRAINT "BatchPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
