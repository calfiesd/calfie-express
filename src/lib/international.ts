import type { ShipmentInput, ShipmentCustomsItemInput } from "@/lib/domain-types";

export function isInternationalShipment(shipment: ShipmentInput) {
  return shipment.shipFrom.countryCode.trim().toUpperCase() !== shipment.shipTo.countryCode.trim().toUpperCase();
}

export function sumCustomsItems(items: ShipmentCustomsItemInput[]) {
  return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitValue)), 0);
}

export function validateInternationalShipment(shipment: ShipmentInput) {
  if (!isInternationalShipment(shipment)) {
    return null;
  }

  const customs = shipment.customs;
  if (!customs) {
    return "International shipments require customs details and line items.";
  }

  if (!customs.reasonForExport.trim()) {
    return "Reason for export is required for international shipments.";
  }

  if (!customs.termsOfSale.trim()) {
    return "Terms of sale are required for international shipments.";
  }

  if (!customs.contentsSummary.trim()) {
    return "A contents summary is required for international shipments.";
  }

  if (!customs.items.length) {
    return "At least one customs line item is required for international shipments.";
  }

  for (const item of customs.items) {
    if (!item.description.trim()) {
      return "Each customs line item needs a description.";
    }

    if (!item.originCountryCode.trim()) {
      return "Each customs line item needs an origin country.";
    }

    if (Number(item.quantity) <= 0) {
      return "Each customs line item needs a quantity greater than zero.";
    }

    if (Number(item.unitValue) <= 0) {
      return "Each customs line item needs a unit value greater than zero.";
    }

    if (Number(item.unitWeight) <= 0) {
      return "Each customs line item needs a unit weight greater than zero.";
    }
  }

  return null;
}

export function buildCommercialInvoice(order: {
  id: string;
  createdAt?: Date;
  quotedCustomerAmount: unknown;
  shipmentJson: ShipmentInput | null;
}) {
  const shipment = order.shipmentJson;
  if (!shipment) {
    return null;
  }

  const customs = shipment.customs;
  const items = customs?.items ?? [];
  const totalDeclaredValue = items.length ? sumCustomsItems(items) : Number(shipment.declaredValue ?? 0);

  return {
    invoiceNumber: customs?.invoiceNumber?.trim() || `CI-${order.id.slice(-8).toUpperCase()}`,
    invoiceDate: (order.createdAt ?? new Date()).toISOString(),
    reasonForExport: customs?.reasonForExport ?? "",
    termsOfSale: customs?.termsOfSale ?? "",
    nonDeliveryOption: customs?.nonDeliveryOption ?? "RETURN",
    exporterTaxId: customs?.exporterTaxId ?? "",
    importerTaxId: customs?.importerTaxId ?? "",
    contentsSummary: customs?.contentsSummary ?? "",
    totalDeclaredValue,
    currency: "USD",
    items
  };
}
