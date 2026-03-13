import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";
import { isInternationalShipment } from "@/lib/international";

function normalizeText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown carrier purchase error");
}

function inferInternationalHint(rawMessage: string) {
  const lower = rawMessage.toLowerCase();

  if (lower.includes("commodity") || lower.includes("harmonized") || lower.includes("customs")) {
    return "Customs or commodity data appears incomplete. Verify item descriptions, origin country, HS code requirements, and declared values.";
  }

  if (lower.includes("invoice") || lower.includes("international forms")) {
    return "Commercial invoice data may be missing or rejected. Review reason for export, terms of sale, invoice number, and consignee details.";
  }

  if (lower.includes("service") && (lower.includes("not allowed") || lower.includes("unsupported") || lower.includes("not valid"))) {
    return "The selected service may not support this origin/destination pair or this shipment type.";
  }

  if (lower.includes("tax") || lower.includes("vat") || lower.includes("eori") || lower.includes("importer")) {
    return "Tax or importer/exporter identification information may be missing or invalid for this destination.";
  }

  if (lower.includes("country") || lower.includes("postal") || lower.includes("province") || lower.includes("state")) {
    return "Address data may be invalid for the destination country. Recheck postal code, city, province/state, and country combination.";
  }

  if (lower.includes("authentication") || lower.includes("oauth") || lower.includes("permission") || lower.includes("forbidden")) {
    return "Carrier credentials or account permissions may not allow this international shipment flow yet.";
  }

  return "Review customs line items, invoice details, service eligibility, and account permissions for this international shipment.";
}

export function buildCarrierPurchaseDiagnostic(args: {
  carrier: CarrierRate["carrier"];
  shipment: ShipmentInput;
  error: unknown;
}) {
  const rawMessage = normalizeText(args.error);

  if (!isInternationalShipment(args.shipment)) {
    return rawMessage;
  }

  const hint = inferInternationalHint(rawMessage);
  return `${args.carrier} international purchase failed. ${hint} Raw carrier response: ${rawMessage}`;
}
