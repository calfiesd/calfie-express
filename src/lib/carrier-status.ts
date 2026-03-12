import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter, getUpsPurchaseStatus, getUpsVoidStatus } from "@/lib/carriers/ups";
import { FedExAdapter, getFedExPurchaseStatus, getFedExVoidStatus } from "@/lib/carriers/fedex";
import { getStripeStatus } from "@/lib/payments/stripe";

const defaultPricingSummary = {
  markupPercent: 12,
  flatFee: 1.5,
  minimumProfit: 4,
  residentialSurcharge: 1,
  signatureSurcharge: 2.5,
  userId: "carrier-status-check"
};

export async function getCarrierStatusSnapshot() {
  const [upsQuote, fedexQuote] = await Promise.all([
    new UpsAdapter().getRatesWithDiagnostics(demoShipment, defaultPricingSummary),
    new FedExAdapter().getRatesWithDiagnostics(demoShipment, defaultPricingSummary)
  ]);

  return {
    ups: {
      quoteMode: upsQuote.mode,
      quoteDiagnostic: upsQuote.diagnostic ?? "UPS quote diagnostics unavailable.",
      rateCount: upsQuote.rates.length,
      purchase: getUpsPurchaseStatus(),
      voids: getUpsVoidStatus()
    },
    fedex: {
      quoteMode: fedexQuote.status.mode,
      quoteDiagnostic: fedexQuote.status.diagnostic,
      rateCount: fedexQuote.rates.length,
      purchase: getFedExPurchaseStatus(),
      voids: getFedExVoidStatus()
    },
    stripe: getStripeStatus()
  };
}
