-- DropIndex
DROP INDEX IF EXISTS "BatchPurchase_userId_fingerprint_key";

-- AlterTable
ALTER TABLE "BatchPurchase" ADD COLUMN "sourceCsv" TEXT,
ADD COLUMN "retryOfBatchId" TEXT;

-- CreateIndex
CREATE INDEX "BatchPurchase_userId_fingerprint_idx" ON "BatchPurchase"("userId", "fingerprint");
