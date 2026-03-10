import type { CarrierRate, FedExQuoteStatus, PurchasedLabel, PricingProfile, ShipmentInput } from "@/lib/domain-types";
import { applyCustomerPricing } from "@/lib/pricing";
import { demoCustomer } from "@/lib/mock-data";
import type { CarrierAdapter } from "@/lib/carriers/base";
import { env } from "@/lib/config";
import { getFedExAccessToken, requestFedExRates } from "@/lib/fedex/client";

const defaultPricingProfile = demoCustomer.pricingProfile;

type FedExRateReply = {
  rateReplyDetails?: Array<{
    serviceType?: string;
    serviceName?: string;
    deliveryDayOfWeek?: string;
    transitTime?: string;
    ratedShipmentDetails?: Array<{
      accountNumber?: { value?: string };
      rateType?: string;
      totalNetCharge?: number;
      totalBaseCharge?: number;
      totalSurcharges?: number;
      totalNetFedExCharge?: number;
      currency?: string;
    }>;
  }>;
  output?: {
    rateReplyDetails?: FedExRateReply["rateReplyDetails"];
  };
};

function demoRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): CarrierRate[] {
  const zoneDistance = Math.abs(Number(input.shipFrom.postalCode.slice(0, 3)) - Number(input.shipTo.postalCode.slice(0, 3)));
  const dimensionalWeight = (input.packageLength * input.packageWidth * input.packageHeight) / 139;
  const billableWeight = Math.max(input.packageWeight, dimensionalWeight);
  const baseCost = Number((9.1 + zoneDistance / 95 + billableWeight * 1.72).toFixed(2));
  const accountLabel = env.FEDEX_ACCOUNT_NUMBER ? `${env.FEDEX_ACCOUNT_NUMBER} (demo)` : "FedEx demo account";

  const groundCost = baseCost;
  const twoDayCost = Number((baseCost * 1.52).toFixed(2));
  const overnightCost = Number((baseCost * 1.94).toFixed(2));

  return [
    {
      carrier: "FEDEX",
      serviceCode: "fedex_ground",
      serviceName: "FedEx Ground",
      transitDays: 4,
      carrierCost: groundCost,
      customerPrice: applyCustomerPricing(groundCost, pricingProfile, input),
      currency: "USD",
      accountNumber: env.FEDEX_ACCOUNT_NUMBER,
      accountLabel
    },
    {
      carrier: "FEDEX",
      serviceCode: "fedex_2day",
      serviceName: "FedEx 2Day",
      transitDays: 2,
      carrierCost: twoDayCost,
      customerPrice: applyCustomerPricing(twoDayCost, pricingProfile, input),
      currency: "USD",
      accountNumber: env.FEDEX_ACCOUNT_NUMBER,
      accountLabel
    },
    {
      carrier: "FEDEX",
      serviceCode: "fedex_priority_overnight",
      serviceName: "FedEx Priority Overnight",
      transitDays: 1,
      carrierCost: overnightCost,
      customerPrice: applyCustomerPricing(overnightCost, pricingProfile, input),
      currency: "USD",
      accountNumber: env.FEDEX_ACCOUNT_NUMBER,
      accountLabel
    }
  ];
}

function normalizeTransitDays(value?: string) {
  if (!value) {
    return 0;
  }

  const lower = value.toLowerCase();
  if (lower.includes("one") || lower.includes("next_day")) {
    return 1;
  }
  if (lower.includes("two")) {
    return 2;
  }
  if (lower.includes("three")) {
    return 3;
  }
  if (lower.includes("four")) {
    return 4;
  }

  const numeric = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function normalizeFedExRates(payload: FedExRateReply, input: ShipmentInput, pricingProfile: PricingProfile): CarrierRate[] {
  const replyDetails = payload.output?.rateReplyDetails ?? payload.rateReplyDetails ?? [];
  const accountLabel = env.FEDEX_ACCOUNT_NUMBER ? `${env.FEDEX_ACCOUNT_NUMBER} (live)` : "FedEx live account";

  return replyDetails.flatMap((detail) => {
    const accountRate = detail.ratedShipmentDetails?.find((rate) => rate.rateType === "ACCOUNT")
      ?? detail.ratedShipmentDetails?.[0];

    if (!accountRate) {
      return [];
    }

    const carrierCost = Number(accountRate.totalNetCharge ?? accountRate.totalNetFedExCharge ?? accountRate.totalBaseCharge ?? 0);
    if (!carrierCost) {
      return [];
    }

    return [{
      carrier: "FEDEX" as const,
      serviceCode: detail.serviceType ?? detail.serviceName ?? "fedex_service",
      serviceName: detail.serviceName ?? detail.serviceType ?? "FedEx service",
      transitDays: normalizeTransitDays(detail.transitTime),
      carrierCost,
      customerPrice: applyCustomerPricing(carrierCost, pricingProfile, input),
      currency: (accountRate.currency as "USD") ?? "USD",
      accountNumber: env.FEDEX_ACCOUNT_NUMBER,
      accountLabel
    }];
  }).sort((left, right) => left.customerPrice - right.customerPrice);
}

export class FedExAdapter implements CarrierAdapter {
  async getRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<CarrierRate[]> {
    const result = await this.getRatesWithDiagnostics(input, pricingProfile);
    return result.rates;
  }

  async getRatesWithDiagnostics(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<{ rates: CarrierRate[]; status: FedExQuoteStatus }> {
    if (!env.FEDEX_API_KEY || !env.FEDEX_SECRET_KEY || !env.FEDEX_ACCOUNT_NUMBER) {
      return {
        rates: demoRates(input, pricingProfile),
        status: {
          mode: "misconfigured",
          diagnostic: "FedEx fallback demo pricing is active because FEDEX_API_KEY, FEDEX_SECRET_KEY, or FEDEX_ACCOUNT_NUMBER is missing."
        }
      };
    }

    try {
      const accessToken = await getFedExAccessToken();
      if (!accessToken) {
        return {
          rates: demoRates(input, pricingProfile),
          status: {
            mode: "fallback",
            diagnostic: "FedEx OAuth returned no access token, so demo comparison pricing is being used."
          }
        };
      }

      const payload = await requestFedExRates(accessToken, input) as FedExRateReply;
      const liveRates = normalizeFedExRates(payload, input, pricingProfile);
      if (liveRates.length > 0) {
        return {
          rates: liveRates,
          status: {
            mode: "live",
            diagnostic: `FedEx live rates returned for account ${env.FEDEX_ACCOUNT_NUMBER}.`
          }
        };
      }

      return {
        rates: demoRates(input, pricingProfile),
        status: {
          mode: "fallback",
          diagnostic: "FedEx rate API returned no usable live services, so demo comparison pricing is being used."
        }
      };
    } catch (error) {
      return {
        rates: demoRates(input, pricingProfile),
        status: {
          mode: "fallback",
          diagnostic: error instanceof Error
            ? `FedEx live rate request failed: ${error.message}`
            : "FedEx live rate request failed, so demo comparison pricing is being used."
        }
      };
    }
  }

  async buyLabel(args: { orderId: string; shipment: ShipmentInput; rate: CarrierRate }): Promise<PurchasedLabel> {
    return {
      carrier: "FEDEX",
      serviceName: args.rate.serviceName,
      trackingNumber: `FDX-DEMO-${args.orderId.slice(-6).toUpperCase()}`,
      labelUrl: "/labels/demo-fedex-label.pdf",
      carrierCharge: args.rate.carrierCost
    };
  }

  async voidLabel(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }
}
