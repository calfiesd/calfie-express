import type { ShipmentInput } from "@/lib/domain-types";
import { buildCommercialInvoice, isInternationalShipment, sumCustomsItems } from "@/lib/international";

function buildStreetLines(line1: string, line2?: string) {
  return [line1, line2].filter(Boolean);
}

function normalizeReasonForExport(reason: string) {
  const value = reason.trim().toLowerCase();

  if (value.includes("gift")) {
    return "GIFT";
  }

  if (value.includes("sample")) {
    return "SAMPLE";
  }

  if (value.includes("return") || value.includes("repair")) {
    return "RETURN";
  }

  return "SOLD";
}

export function getCarrierCustomsSummary(shipment: ShipmentInput) {
  if (!isInternationalShipment(shipment) || !shipment.customs?.items.length) {
    return null;
  }

  const declaredValue = sumCustomsItems(shipment.customs.items) || Number(shipment.declaredValue ?? 0);
  const invoice = buildCommercialInvoice({
    id: `draft-${Date.now()}`,
    shipmentJson: shipment,
    quotedCustomerAmount: 0
  });

  return {
    declaredValue,
    invoiceNumber: invoice?.invoiceNumber ?? "",
    invoiceDate: invoice?.invoiceDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    contentsSummary: shipment.customs.contentsSummary,
    reasonForExport: shipment.customs.reasonForExport,
    termsOfSale: shipment.customs.termsOfSale,
    nonDeliveryOption: shipment.customs.nonDeliveryOption,
    exporterTaxId: shipment.customs.exporterTaxId,
    importerTaxId: shipment.customs.importerTaxId,
    items: shipment.customs.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitValue: item.unitValue,
      unitWeight: item.unitWeight,
      lineValue: Number((item.quantity * item.unitValue).toFixed(2)),
      totalWeight: Number((item.quantity * item.unitWeight).toFixed(2)),
      hsCode: item.hsCode?.trim() || undefined,
      sku: item.sku?.trim() || undefined,
      originCountryCode: item.originCountryCode.trim().toUpperCase()
    })),
    shipFromStreetLines: buildStreetLines(shipment.shipFrom.line1, shipment.shipFrom.line2),
    shipToStreetLines: buildStreetLines(shipment.shipTo.line1, shipment.shipTo.line2)
  };
}

export function buildUpsInternationalForms(shipment: ShipmentInput) {
  const customs = getCarrierCustomsSummary(shipment);
  if (!customs) {
    return undefined;
  }

  return {
    FormType: "01",
    InvoiceNumber: customs.invoiceNumber,
    InvoiceDate: customs.invoiceDate.replaceAll("-", ""),
    ReasonForExport: customs.reasonForExport,
    CurrencyCode: "USD",
    TermsOfShipment: customs.termsOfSale,
    InvoiceLineTotal: {
      CurrencyCode: "USD",
      MonetaryValue: String(customs.declaredValue.toFixed(2))
    },
    Product: customs.items.map((item) => ({
      Description: item.description,
      CommodityCode: item.hsCode,
      OriginCountryCode: item.originCountryCode,
      NumberOfPackagesPerCommodity: "1",
      Unit: {
        Number: String(item.quantity),
        UnitOfMeasurement: {
          Code: "PCS"
        },
        Value: String(item.unitValue.toFixed(2))
      },
      UnitPrice: {
        CurrencyCode: "USD",
        MonetaryValue: String(item.unitValue.toFixed(2))
      },
      ProductWeight: {
        UnitOfMeasurement: {
          Code: "LBS"
        },
        Weight: String(item.totalWeight.toFixed(2))
      }
    }))
  };
}

export function buildFedExCustomsClearanceDetail(shipment: ShipmentInput) {
  const customs = getCarrierCustomsSummary(shipment);
  if (!customs) {
    return undefined;
  }

  return {
    documentContent: "NON_DOCUMENTS",
    customsValue: {
      amount: customs.declaredValue,
      currency: "USD"
    },
    commercialInvoice: {
      shipmentPurpose: normalizeReasonForExport(customs.reasonForExport),
      termsOfSale: customs.termsOfSale
    },
    commodities: customs.items.map((item) => ({
      description: item.description,
      numberOfPieces: item.quantity,
      quantity: item.quantity,
      quantityUnits: "PCS",
      unitPrice: {
        amount: item.unitValue,
        currency: "USD"
      },
      customsValue: {
        amount: item.lineValue,
        currency: "USD"
      },
      weight: {
        units: "LB",
        value: item.totalWeight
      },
      countryOfManufacture: item.originCountryCode,
      harmonizedCode: item.hsCode,
      partNumber: item.sku
    }))
  };
}
