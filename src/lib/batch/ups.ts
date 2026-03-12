import { createHash } from "crypto";
import type { CarrierRate, PricingProfile, ShipmentInput, UpsBatchPreviewRow } from "@/lib/domain-types";
import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter } from "@/lib/carriers/ups";
import { parseUpsBatchCsv, type UpsBatchParsedRow } from "@/lib/batch/ups-csv";
import { requireUser } from "@/lib/auth/session";

export type UpsBatchQuotedRow = {
  parsedRow: UpsBatchParsedRow;
  previewRow: UpsBatchPreviewRow;
  matchedRate?: CarrierRate;
};

async function runInBatches<T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }

  return results;
}

export function createUpsBatchFingerprint(userId: string, csvText: string) {
  const normalized = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");

  return createHash("sha256").update(`${userId}:${normalized}`).digest("hex");
}

export function buildUpsBatchPricingProfile(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  return {
    userId: user.id,
    markupPercent: Number(user.pricingProfile!.markupPercent),
    flatFee: Number(user.pricingProfile!.flatFee),
    minimumProfit: Number(user.pricingProfile!.minimumProfit),
    residentialSurcharge: Number(user.pricingProfile!.residentialSurcharge),
    signatureSurcharge: Number(user.pricingProfile!.signatureSurcharge),
    allowUps: user.pricingProfile!.allowUps,
    allowFedex: user.pricingProfile!.allowFedex,
    allowUpsPurchase: user.pricingProfile!.allowUpsPurchase,
    allowFedexPurchase: user.pricingProfile!.allowFedexPurchase
  } satisfies PricingProfile;
}

export function buildUpsBatchShipFrom(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
  return {
    ...demoShipment.shipFrom,
    name: user.companyName || user.name,
    company: user.companyName || user.name,
    email: user.email
  } satisfies ShipmentInput["shipFrom"];
}

export async function quoteUpsBatchRows(args: {
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  csvText: string;
}) {
  const parsedRows = parseUpsBatchCsv(args.csvText, buildUpsBatchShipFrom(args.user), args.user.id);
  const pricingProfile = buildUpsBatchPricingProfile(args.user);
  const adapter = new UpsAdapter();

  const rows = await runInBatches(parsedRows, 4, async (parsedRow): Promise<UpsBatchQuotedRow> => {
    try {
      const result = await adapter.getRatesWithDiagnostics(parsedRow.shipment, pricingProfile);
      const matchedRate = result.rates.find((rate: CarrierRate) => rate.serviceCode === parsedRow.requestedServiceCode);

      if (!matchedRate) {
        return {
          parsedRow,
          previewRow: {
            rowNumber: parsedRow.rowNumber,
            recipientName: parsedRow.recipientName,
            companyName: parsedRow.companyName,
            destination: parsedRow.destination,
            reference1: parsedRow.reference1,
            requestedServiceCode: parsedRow.requestedServiceCode,
            requestedServiceName: parsedRow.requestedServiceName,
            status: "error",
            message: `Requested service ${parsedRow.requestedServiceCode} was not returned by UPS for this shipment.`
          }
        };
      }

      return {
        parsedRow,
        matchedRate,
        previewRow: {
          rowNumber: parsedRow.rowNumber,
          recipientName: parsedRow.recipientName,
          companyName: parsedRow.companyName,
          destination: parsedRow.destination,
          reference1: parsedRow.reference1,
          requestedServiceCode: parsedRow.requestedServiceCode,
          requestedServiceName: matchedRate.serviceName,
          accountNumber: matchedRate.accountNumber,
          accountLabel: matchedRate.accountLabel,
          carrierCost: matchedRate.carrierCost,
          customerPrice: matchedRate.customerPrice,
          status: "quoted",
          message: result.mode === "fallback" ? result.diagnostic : undefined
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UPS batch quote failed.";

      return {
        parsedRow,
        previewRow: {
          rowNumber: parsedRow.rowNumber,
          recipientName: parsedRow.recipientName,
          companyName: parsedRow.companyName,
          destination: parsedRow.destination,
          reference1: parsedRow.reference1,
          requestedServiceCode: parsedRow.requestedServiceCode,
          requestedServiceName: parsedRow.requestedServiceName,
          status: "error",
          message
        }
      };
    }
  });

  const quotedRows = rows.filter((row) => row.previewRow.status === "quoted");

  return {
    parsedRows,
    quotedRows,
    rows,
    totals: {
      rowCount: rows.length,
      quotedCount: quotedRows.length,
      errorCount: rows.length - quotedRows.length,
      purchasedCount: 0,
      failedCount: 0,
      carrierCostTotal: quotedRows.reduce((sum, row) => sum + (row.previewRow.carrierCost ?? 0), 0),
      customerPriceTotal: quotedRows.reduce((sum, row) => sum + (row.previewRow.customerPrice ?? 0), 0)
    }
  };
}

