import type { CarrierCode, ShipmentInput, ShipmentPackageType } from "@/lib/domain-types";

export const PACKAGE_TYPE_OPTIONS: Array<{ value: ShipmentPackageType; label: string }> = [
  { value: "CUSTOMER_SUPPLIED", label: "Your box / own packaging" },
  { value: "UPS_LETTER", label: "UPS Letter" },
  { value: "UPS_PAK", label: "UPS Pak" },
  { value: "UPS_TUBE", label: "UPS Tube" },
  { value: "FEDEX_ENVELOPE", label: "FedEx Envelope" },
  { value: "FEDEX_PAK", label: "FedEx Pak" },
  { value: "FEDEX_BOX", label: "FedEx Box" },
  { value: "FEDEX_TUBE", label: "FedEx Tube" }
];

export function packageTypeMatchesCarrier(packageType: ShipmentPackageType, carrier: CarrierCode | "ALL") {
  if (carrier === "ALL" || packageType === "CUSTOMER_SUPPLIED") {
    return true;
  }

  return carrier === "UPS"
    ? packageType.startsWith("UPS_")
    : packageType.startsWith("FEDEX_");
}

export function getPackageTypeLabel(packageType: ShipmentPackageType) {
  return PACKAGE_TYPE_OPTIONS.find((option) => option.value === packageType)?.label ?? packageType;
}

export function getPackageTypeRules(packageType: ShipmentPackageType) {
  switch (packageType) {
    case "UPS_LETTER":
      return {
        hideDimensions: true,
        maxWeightLbs: 1,
        note: "UPS Letter uses carrier-standard packaging. Dimensions are fixed and weight must stay at or below 1 lb."
      };
    case "UPS_PAK":
      return {
        hideDimensions: true,
        maxWeightLbs: null,
        note: "UPS Pak uses carrier packaging with fixed dimensions. Enter weight only and confirm the contents are suitable for a flat pak."
      };
    case "UPS_TUBE":
      return {
        hideDimensions: true,
        maxWeightLbs: null,
        note: "UPS Tube uses carrier packaging with fixed dimensions. Enter weight only and confirm the contents are suitable for tube packaging."
      };
    case "FEDEX_ENVELOPE":
      return {
        hideDimensions: true,
        maxWeightLbs: 1,
        note: "FedEx Envelope uses carrier-standard packaging. Dimensions are fixed and weight must stay at or below 1 lb."
      };
    case "FEDEX_PAK":
      return {
        hideDimensions: true,
        maxWeightLbs: 5.5,
        note: "FedEx Pak uses carrier packaging with fixed dimensions. Weight must stay at or below 5.5 lb."
      };
    case "FEDEX_BOX":
      return {
        hideDimensions: true,
        maxWeightLbs: 20,
        note: "FedEx Box uses carrier-standard box dimensions. Weight must stay at or below 20 lb for the standard package range."
      };
    case "FEDEX_TUBE":
      return {
        hideDimensions: true,
        maxWeightLbs: 20,
        note: "FedEx Tube uses a fixed carrier tube size. Weight must stay at or below 20 lb."
      };
    default:
      return {
        hideDimensions: false,
        maxWeightLbs: null,
        note: null
      };
  }
}

export function applyPackageTypePreset(shipment: ShipmentInput, packageType: ShipmentPackageType): ShipmentInput {
  const rules = getPackageTypeRules(packageType);

  return {
    ...shipment,
    packageType,
    simpleRate: packageType === "CUSTOMER_SUPPLIED" ? shipment.simpleRate : false,
    packageLength: rules.hideDimensions ? 0 : shipment.packageLength,
    packageWidth: rules.hideDimensions ? 0 : shipment.packageWidth,
    packageHeight: rules.hideDimensions ? 0 : shipment.packageHeight,
    packageWeight: rules.maxWeightLbs ? Math.min(shipment.packageWeight || rules.maxWeightLbs, rules.maxWeightLbs) : shipment.packageWeight
  };
}

export function validatePackageTypeSelection(shipment: ShipmentInput) {
  const rules = getPackageTypeRules(shipment.packageType);

  if (rules.maxWeightLbs !== null && Number(shipment.packageWeight) > rules.maxWeightLbs) {
    return `${getPackageTypeLabel(shipment.packageType)} must stay at or below ${rules.maxWeightLbs} lb.`;
  }

  return null;
}

export function resolveCarrierPackagePreset(carrier: CarrierCode, packageType: ShipmentPackageType) {
  if (carrier === "UPS") {
    switch (packageType) {
      case "UPS_LETTER":
        return { label: "UPS Letter", upsCode: "01", fedexCode: undefined };
      case "UPS_PAK":
        return { label: "UPS Pak", upsCode: "04", fedexCode: undefined };
      case "UPS_TUBE":
        return { label: "UPS Tube", upsCode: "03", fedexCode: undefined };
      default:
        return { label: "Customer supplied package", upsCode: "02", fedexCode: undefined };
    }
  }

  switch (packageType) {
    case "FEDEX_ENVELOPE":
      return { label: "FedEx Envelope", upsCode: undefined, fedexCode: "FEDEX_ENVELOPE" };
    case "FEDEX_PAK":
      return { label: "FedEx Pak", upsCode: undefined, fedexCode: "FEDEX_PAK" };
    case "FEDEX_BOX":
      return { label: "FedEx Box", upsCode: undefined, fedexCode: "FEDEX_BOX" };
    case "FEDEX_TUBE":
      return { label: "FedEx Tube", upsCode: undefined, fedexCode: "FEDEX_TUBE" };
    default:
      return { label: "Your packaging", upsCode: undefined, fedexCode: "YOUR_PACKAGING" };
  }
}
