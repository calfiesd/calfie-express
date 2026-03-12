-- AlterTable
ALTER TABLE "PricingProfile"
ADD COLUMN "allowUpsPurchase" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowFedexPurchase" BOOLEAN NOT NULL DEFAULT true;
