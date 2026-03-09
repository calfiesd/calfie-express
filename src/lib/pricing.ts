import type { CarrierRate, PricingProfile } from "@/lib/domain-types";

export function applyCustomerPricing(rateCost: number, profile: PricingProfile, options: {
  residential: boolean;
  signatureRequired: boolean;
}): number {
  const percentMarkup = rateCost * (profile.markupPercent / 100);
  const accessorialMarkup =
    (options.residential ? profile.residentialSurcharge : 0) +
    (options.signatureRequired ? profile.signatureSurcharge : 0);

  const rawPrice = rateCost + percentMarkup + profile.flatFee + accessorialMarkup;
  const minimumAllowed = rateCost + profile.minimumProfit;

  return Number(Math.max(rawPrice, minimumAllowed).toFixed(2));
}

export function summarizeMargin(rate: CarrierRate): number {
  return Number((rate.customerPrice - rate.carrierCost).toFixed(2));
}
