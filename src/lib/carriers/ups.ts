import { env } from "@/lib/config";
import type { CarrierRate, PricingProfile, PurchasedLabel, ShipmentInput, UpsDebugAccount, UpsDebugRate } from "@/lib/domain-types";
import { applyCustomerPricing } from "@/lib/pricing";
import { demoCustomer } from "@/lib/mock-data";
import type { CarrierAdapter } from "@/lib/carriers/base";
import { getUpsAccessToken, requestUpsShipment, requestUpsShopRates } from "@/lib/ups/client";

export type UpsRateResult = {
  mode: "live" | "fallback";
  rates: CarrierRate[];
  diagnostic?: string;
  debugAccounts?: UpsDebugAccount[];
};

const defaultPricingProfile = demoCustomer.pricingProfile;

function getConfiguredUpsAccounts() {
  return env.UPS_ACCOUNT_NUMBER ? [env.UPS_ACCOUNT_NUMBER] : [];
}

function buildDemoRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): CarrierRate[] {
  const zoneDistance = Math.abs(Number(input.shipFrom.postalCode.slice(0, 3)) - Number(input.shipTo.postalCode.slice(0, 3)));
  const dimensionalWeight = (input.packageLength * input.packageWidth * input.packageHeight) / 139;
  const billableWeight = Math.max(input.packageWeight, dimensionalWeight);
  const baseCost = Number((8.75 + zoneDistance / 100 + billableWeight * 1.65).toFixed(2));
  const groundCost = baseCost;
  const airCost = Number((baseCost * 1.68).toFixed(2));
  const defaultAccount = env.UPS_ACCOUNT_NUMBER ?? "demo-account";

  return [
    {
      carrier: "UPS",
      serviceCode: "03",
      serviceName: "UPS Ground",
      transitDays: 4,
      carrierCost: groundCost,
      customerPrice: applyCustomerPricing(groundCost, pricingProfile, input),
      currency: "USD",
      accountNumber: defaultAccount,
      accountLabel: defaultAccount
    },
    {
      carrier: "UPS",
      serviceCode: "02",
      serviceName: "UPS 2nd Day Air",
      transitDays: 2,
      carrierCost: airCost,
      customerPrice: applyCustomerPricing(airCost, pricingProfile, input),
      currency: "USD",
      accountNumber: defaultAccount,
      accountLabel: defaultAccount
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

function parseUpsCharge(shipment: any) {
  const negotiatedTotal = shipment?.NegotiatedRateCharges?.TotalCharge?.MonetaryValue;
  const publishedTotal = shipment?.TotalCharges?.MonetaryValue;
  const freightNetCharge = shipment?.FRSShipmentData?.TransportationCharges?.NetCharge?.MonetaryValue;
  const chargeSource = negotiatedTotal ? "negotiated" : freightNetCharge ? "freight_net" : "published";
  const monetaryValue = negotiatedTotal ?? freightNetCharge ?? publishedTotal ?? 0;

  return {
    carrierCost: Number(monetaryValue),
    chargeSource,
    totalCharges: publishedTotal ? Number(publishedTotal) : undefined,
    negotiatedCharges: negotiatedTotal ? Number(negotiatedTotal) : undefined,
    freightNetCharge: freightNetCharge ? Number(freightNetCharge) : undefined
  };
}

function buildDebugRate(shipment: any): UpsDebugRate {
  const parsedCharge = parseUpsCharge(shipment);
  const serviceCode = String(shipment?.Service?.Code ?? "ups_service");

  return {
    serviceCode,
    serviceName: serviceNameFromCode(serviceCode),
    totalCharges: parsedCharge.totalCharges,
    negotiatedCharges: parsedCharge.negotiatedCharges,
    freightNetCharge: parsedCharge.freightNetCharge,
    chargeSource: parsedCharge.chargeSource as UpsDebugRate["chargeSource"],
    selectedCharge: parsedCharge.carrierCost
  };
}

function normalizeUpsRates(payload: any, input: ShipmentInput, pricingProfile: PricingProfile, accountNumber: string): CarrierRate[] {
  const ratedShipment = payload?.RateResponse?.RatedShipment;
  const shipments = Array.isArray(ratedShipment) ? ratedShipment : ratedShipment ? [ratedShipment] : [];

  return shipments.map((shipment: any) => {
    const parsedCharge = parseUpsCharge(shipment);
    const serviceCode = String(shipment?.Service?.Code ?? "ups_service");

    return {
      carrier: "UPS" as const,
      serviceCode,
      serviceName: serviceNameFromCode(serviceCode),
      transitDays: Number(shipment?.GuaranteedDelivery?.BusinessDaysInTransit ?? 0),
      carrierCost: parsedCharge.carrierCost,
      customerPrice: applyCustomerPricing(parsedCharge.carrierCost, pricingProfile, input),
      currency: "USD" as const,
      accountNumber,
      accountLabel: `${accountNumber} (${parsedCharge.chargeSource})`
    };
  });
}

function buildDebugAccount(accountNumber: string, payload: any): UpsDebugAccount {
  const ratedShipment = payload?.RateResponse?.RatedShipment;
  const shipments = Array.isArray(ratedShipment) ? ratedShipment : ratedShipment ? [ratedShipment] : [];

  return {
    accountNumber,
    status: "success",
    rates: shipments.map((shipment: any) => buildDebugRate(shipment))
  };
}

function chooseLowestRatesByService(rates: CarrierRate[]) {
  const bestByService = new Map<string, CarrierRate>();

  for (const rate of rates) {
    const current = bestByService.get(rate.serviceCode);
    if (!current || rate.carrierCost < current.carrierCost) {
      bestByService.set(rate.serviceCode, rate);
    }
  }

  return Array.from(bestByService.values()).sort((left, right) => left.customerPrice - right.customerPrice);
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

function summarizeAccountRates(account: UpsDebugAccount) {
  if (account.rates.length === 0) {
    return `${account.accountNumber}: no rates returned`;
  }

  const summary = account.rates
    .map((rate) => `${rate.serviceCode} ${rate.selectedCharge.toFixed(2)}`)
    .join(", ");

  return `${account.accountNumber}: ${summary}`;
}

export class UpsAdapter implements CarrierAdapter {
  async getRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<CarrierRate[]> {
    const result = await this.getRatesWithDiagnostics(input, pricingProfile);
    return result.rates;
  }

  async getRatesWithDiagnostics(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<UpsRateResult> {
    const accounts = getConfiguredUpsAccounts();
    if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET || accounts.length === 0) {
      return {
        mode: "fallback",
        rates: buildDemoRates(input, pricingProfile),
        diagnostic: "Missing UPS credentials or single active UPS account in environment configuration."
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

      const accountNumber = accounts[0];
      const payload = await requestUpsShopRates(accessToken, input, accountNumber);
      const rates = chooseLowestRatesByService(normalizeUpsRates(payload, input, pricingProfile, accountNumber));
      const debugAccount = buildDebugAccount(accountNumber, payload);

      if (rates.length === 0) {
        return {
          mode: "fallback",
          rates: buildDemoRates(input, pricingProfile),
          diagnostic: `${accountNumber}: no rated shipments were returned.`,
          debugAccounts: [debugAccount]
        };
      }

      const diagnostic = `UPS ${accountNumber} responses -> ${summarizeAccountRates(debugAccount)}`;

      return {
        mode: "live",
        rates,
        diagnostic,
        debugAccounts: [debugAccount]
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

    const accountNumber = env.UPS_ACCOUNT_NUMBER;
    if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET || !accountNumber) {
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

  async voidLabel(args: {
    orderId: string;
    trackingNumber?: string | null;
    shipment?: ShipmentInput | null;
    rate?: CarrierRate | null;
  }): Promise<{ accepted: boolean; mode: "live" | "manual" | "demo"; diagnostic?: string }> {
    return {
      accepted: false,
      mode: "manual",
      diagnostic: `Automatic UPS void is not implemented yet. Void shipment ${args.trackingNumber ?? args.orderId} manually in UPS, then mark the order refunded.`
    };
  }
}
