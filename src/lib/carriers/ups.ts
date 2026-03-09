import { env } from "@/lib/config";
import type { CarrierRate, PricingProfile, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";
import { applyCustomerPricing } from "@/lib/pricing";
import { demoCustomer } from "@/lib/mock-data";
import type { CarrierAdapter } from "@/lib/carriers/base";
import { getUpsAccessToken, requestUpsShipment, requestUpsShopRates } from "@/lib/ups/client";

export type UpsRateResult = {
  mode: "live" | "fallback";
  rates: CarrierRate[];
  diagnostic?: string;
};

const defaultPricingProfile = demoCustomer.pricingProfile;

function buildDemoRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): CarrierRate[] {
  const zoneDistance = Math.abs(Number(input.shipFrom.postalCode.slice(0, 3)) - Number(input.shipTo.postalCode.slice(0, 3)));
  const dimensionalWeight = (input.packageLength * input.packageWidth * input.packageHeight) / 139;
  const billableWeight = Math.max(input.packageWeight, dimensionalWeight);
  const baseCost = Number((8.75 + zoneDistance / 100 + billableWeight * 1.65).toFixed(2));
  const groundCost = baseCost;
  const airCost = Number((baseCost * 1.68).toFixed(2));

  return [
    {
      carrier: "UPS",
      serviceCode: "03",
      serviceName: "UPS Ground",
      transitDays: 4,
      carrierCost: groundCost,
      customerPrice: applyCustomerPricing(groundCost, pricingProfile, input),
      currency: "USD"
    },
    {
      carrier: "UPS",
      serviceCode: "02",
      serviceName: "UPS 2nd Day Air",
      transitDays: 2,
      carrierCost: airCost,
      customerPrice: applyCustomerPricing(airCost, pricingProfile, input),
      currency: "USD"
    }
  ];
}

function serviceNameFromCode(serviceCode: string) {
  const map: Record<string, string> = {
    "01": "UPS Next Day Air",
    "02": "UPS 2nd Day Air",
    "03": "UPS Ground",
    "12": "UPS 3 Day Select",
    "13": "UPS Next Day Air Saver",
    "14": "UPS Next Day Air Early",
    "59": "UPS Second Day Air A.M."
  };
  return map[serviceCode] ?? `UPS ${serviceCode}`;
}

function normalizeUpsRates(payload: any, input: ShipmentInput, pricingProfile: PricingProfile): CarrierRate[] {
  const ratedShipment = payload?.RateResponse?.RatedShipment;
  const shipments = Array.isArray(ratedShipment) ? ratedShipment : ratedShipment ? [ratedShipment] : [];

  return shipments.map((shipment: any) => {
    const carrierCost = Number(shipment?.TotalCharges?.MonetaryValue ?? 0);
    const serviceCode = String(shipment?.Service?.Code ?? "ups_service");

    return {
      carrier: "UPS" as const,
      serviceCode,
      serviceName: serviceNameFromCode(serviceCode),
      transitDays: Number(shipment?.GuaranteedDelivery?.BusinessDaysInTransit ?? 0),
      carrierCost,
      customerPrice: applyCustomerPricing(carrierCost, pricingProfile, input),
      currency: "USD" as const
    };
  });
}

function normalizeUpsShipment(payload: any, fallbackRate: CarrierRate): PurchasedLabel {
  const shipmentResults = payload?.ShipmentResponse?.ShipmentResults;
  const packageResults = shipmentResults?.PackageResults;
  const firstPackage = Array.isArray(packageResults) ? packageResults[0] : packageResults;
  const trackingNumber = firstPackage?.TrackingNumber ?? shipmentResults?.ShipmentIdentificationNumber ?? `UPS-${Date.now()}`;
  const graphicImage = firstPackage?.ShippingLabel?.GraphicImage ?? "";
  const labelUrl = graphicImage ? `data:image/gif;base64,${graphicImage}` : "";

  return {
    carrier: "UPS",
    serviceName: fallbackRate.serviceName,
    trackingNumber,
    labelUrl,
    carrierCharge: fallbackRate.carrierCost
  };
}

export class UpsAdapter implements CarrierAdapter {
  async getRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<CarrierRate[]> {
    const result = await this.getRatesWithDiagnostics(input, pricingProfile);
    return result.rates;
  }

  async getRatesWithDiagnostics(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<UpsRateResult> {
    if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET || !env.UPS_ACCOUNT_NUMBER) {
      return {
        mode: "fallback",
        rates: buildDemoRates(input, pricingProfile),
        diagnostic: "Missing UPS credentials or account number in environment configuration."
      };
    }

    try {
      const accessToken = await getUpsAccessToken();
      if (!accessToken) {
        return {
          mode: "fallback",
          rates: buildDemoRates(input, pricingProfile),
          diagnostic: "UPS OAuth did not return an access token."
        };
      }

      const payload = await requestUpsShopRates(accessToken, input);
      const rates = normalizeUpsRates(payload, input, pricingProfile);

      if (rates.length === 0) {
        return {
          mode: "fallback",
          rates: buildDemoRates(input, pricingProfile),
          diagnostic: "UPS responded, but no rated shipments were returned."
        };
      }

      return {
        mode: "live",
        rates,
        diagnostic: "Live UPS rating response returned successfully."
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown UPS error";
      return {
        mode: "fallback",
        rates: buildDemoRates(input, pricingProfile),
        diagnostic: message
      };
    }
  }

  async buyLabel(args: { orderId: string; shipment: ShipmentInput; rate: CarrierRate }): Promise<PurchasedLabel> {
    if (!env.ALLOW_LIVE_LABEL_PURCHASE) {
      throw new Error("Live UPS label purchase is disabled. Set ALLOW_LIVE_LABEL_PURCHASE=true only when you are ready for real carrier charges.");
    }

    if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET || !env.UPS_ACCOUNT_NUMBER) {
      return {
        carrier: "UPS",
        serviceName: args.rate.serviceName,
        trackingNumber: `UPS-DEMO-${args.orderId.slice(-6).toUpperCase()}`,
        labelUrl: "/labels/demo-ups-label.pdf",
        carrierCharge: args.rate.carrierCost
      };
    }

    const accessToken = await getUpsAccessToken();
    if (!accessToken) {
      throw new Error("UPS OAuth did not return an access token for shipment purchase.");
    }

    const payload = await requestUpsShipment(accessToken, args);
    return normalizeUpsShipment(payload, args.rate);
  }

  async voidLabel(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }
}