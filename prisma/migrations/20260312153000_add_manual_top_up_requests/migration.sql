CREATE TYPE "ManualTopUpRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ManualTopUpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "status" "ManualTopUpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedByAdmin" TEXT,
    "walletTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTopUpRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualTopUpRequest_userId_createdAt_idx" ON "ManualTopUpRequest"("userId", "createdAt");
CREATE INDEX "ManualTopUpRequest_status_createdAt_idx" ON "ManualTopUpRequest"("status", "createdAt");

ALTER TABLE "ManualTopUpRequest" ADD CONSTRAINT "ManualTopUpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
