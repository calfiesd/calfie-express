import type { CarrierRate, PurchasedLabel, PricingProfile, ShipmentInput } from "@/lib/domain-types";
import { applyCustomerPricing } from "@/lib/pricing";
import { demoCustomer } from "@/lib/mock-data";
import type { CarrierAdapter } from "@/lib/carriers/base";
import { env } from "@/lib/config";

const defaultPricingProfile = demoCustomer.pricingProfile;

export class FedExAdapter implements CarrierAdapter {
  async getRates(input: ShipmentInput, pricingProfile: PricingProfile = defaultPricingProfile): Promise<CarrierRate[]> {
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
