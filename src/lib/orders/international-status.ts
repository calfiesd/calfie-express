import type { ShipmentInput } from "@/lib/domain-types";
import { isInternationalShipment } from "@/lib/international";

export function getInternationalOrderStatus(order: {
  shipmentJson: ShipmentInput | null;
  labelUrl?: string | null;
  trackingNumber?: string | null;
}) {
  const shipment = order.shipmentJson;
  if (!shipment || !isInternationalShipment(shipment)) {
    return null;
  }

  const hasCustoms = Boolean(
    shipment.customs?.reasonForExport &&
    shipment.customs?.termsOfSale &&
    shipment.customs?.contentsSummary &&
    shipment.customs.items.length
  );
  const hasInvoice = hasCustoms;
  const labelReady = Boolean(order.labelUrl);
  const trackingReady = Boolean(order.trackingNumber);

  return {
    mode: "international" as const,
    customsReady: hasCustoms,
    invoiceReady: hasInvoice,
    labelReady,
    trackingReady,
    summary: !hasCustoms
      ? "Customs details incomplete"
      : !labelReady
        ? "Invoice ready, label pending"
        : "Invoice and label ready"
  };
}
