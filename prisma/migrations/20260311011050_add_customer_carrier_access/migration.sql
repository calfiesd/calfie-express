-- AlterTable
ALTER TABLE "PricingProfile" ADD COLUMN     "allowFedex" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowUps" BOOLEAN NOT NULL DEFAULT true;
