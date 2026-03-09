import { env } from "@/lib/config";
import type { CarrierRate, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";
import { applyCustomerPricing } from "@/lib/pricing";
import { demoCustomer } from "@/lib/mock-data";
import type { CarrierAdapter } from "@/lib/carriers/base";

export class FedExAdapter implements CarrierAdapter {
  async getRates(input: ShipmentInput): Promise<CarrierRate[]> {
    const zoneDistance = Math.abs(Number(input.shipFromPostalCode.slice(0, 3)) - Number(input.shipToPostalCode.slice(0, 3)));
    const dimensionalWeight = (input.packageLength * input.packageWidth * input.packageHeight) / 139;
    const billableWeight = Math.max(input.packageWeight, dimensionalWeight);
    const baseCost = Number((9.1 + zoneDistance / 95 + billableWeight * 1.72).toFixed(2));

    const groundCost = baseCost;
    const overnightCost = Number((baseCost * 1.94).toFixed(2));

    return [
      {
        carrier: "FEDEX",
        serviceCode: "fedex_ground",
        serviceName: "FedEx Ground",
        transitDays: 4,
        carrierCost: groundCost,
        customerPrice: applyCustomerPricing(groundCost, demoCustomer.pricingProfile, input),
        currency: "USD"
      },
      {
        carrier: "FEDEX",
        serviceCode: "fedex_priority_overnight",
        serviceName: "FedEx Priority Overnight",
        transitDays: 1,
        carrierCost: overnightCost,
        customerPrice: applyCustomerPricing(overnightCost, demoCustomer.pricingProfile, input),
        currency: "USD"
      }
    ];
  }

  async buyLabel(orderId: string): Promise<PurchasedLabel> {
    if (!env.FEDEX_API_KEY || !env.FEDEX_SECRET_KEY) {
      return {
        carrier: "FEDEX",
        serviceName: "FedEx Ground",
        trackingNumber: `FDX-DEMO-${orderId.slice(-6).toUpperCase()}`,
        labelUrl: "/labels/demo-fedex-label.pdf",
        carrierCharge: 15.35
      };
    }

    throw new Error("FedEx production integration not implemented yet. Add OAuth and shipment purchase flow here.");
  }

  async voidLabel(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }
}
