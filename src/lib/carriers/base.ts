import type { CarrierRate, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";

export interface CarrierAdapter {
  getRates(input: ShipmentInput): Promise<CarrierRate[]>;
  buyLabel(args: { orderId: string; shipment: ShipmentInput; rate: CarrierRate }): Promise<PurchasedLabel>;
  voidLabel(orderId: string): Promise<{ accepted: boolean }>;
}