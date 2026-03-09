-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "selectedRateJson" JSONB,
ADD COLUMN     "shipmentJson" JSONB;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "shipmentJson" JSONB;
