import type { CarrierRate, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";

export interface CarrierAdapter {
  getRates(input: ShipmentInput): Promise<CarrierRate[]>;
  buyLabel(args: { orderId: string; shipment: ShipmentInput; rate: CarrierRate }): Promise<PurchasedLabel>;
  voidLabel(args: {
    orderId: string;
    trackingNumber?: string | null;
    shipment?: ShipmentInput | null;
    rate?: CarrierRate | null;
  }): Promise<{
    accepted: boolean;
    mode: "live" | "manual" | "demo";
    diagnostic?: string;
  }>;
}