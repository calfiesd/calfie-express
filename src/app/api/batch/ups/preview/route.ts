import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter } from "@/lib/carriers/ups";
import { parseUpsBatchCsv } from "@/lib/batch/ups-csv";
import type { CarrierRate, PricingProfile, UpsBatchPreviewResponse, UpsBatchPreviewRow } from "@/lib/domain-types";

async function runInBatches<T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }

  return results;
}

function buildPricingProfile(user: NonNullable<Awaited<ReturnType<typeof requireUser>>>) {
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

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to preview UPS batch quotes." }, { status: 401 });
  }

  if (user.pricingProfile.allowUps === false) {
    return NextResponse.json({ message: "UPS is disabled for this customer." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === "string" ? body.csvText : "";

  if (!csvText.trim()) {
    return NextResponse.json({ message: "Upload a UPS CSV file before previewing batch quotes." }, { status: 400 });
  }

  const shipFrom = {
    ...demoShipment.shipFrom,
    name: user.companyName || user.name,
    company: user.companyName || user.name,
    email: user.email
  };

  let parsedRows;
  try {
    parsedRows = parseUpsBatchCsv(csvText, shipFrom, user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPS batch CSV could not be parsed.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const pricingProfile = buildPricingProfile(user);
  const adapter = new UpsAdapter();

  const rows = await runInBatches(parsedRows, 4, async (row): Promise<UpsBatchPreviewRow> => {
    try {
      const result = await adapter.getRatesWithDiagnostics(row.shipment, pricingProfile);
      const matchedRate = result.rates.find((rate: CarrierRate) => rate.serviceCode === row.requestedServiceCode);

      if (!matchedRate) {
        return {
          rowNumber: row.rowNumber,
          recipientName: row.recipientName,
          companyName: row.companyName,
          destination: row.destination,
          reference1: row.reference1,
          requestedServiceCode: row.requestedServiceCode,
          requestedServiceName: row.requestedServiceName,
          status: "error",
          message: `Requested service ${row.requestedServiceCode} was not returned by UPS for this shipment.`
        };
      }

      return {
        rowNumber: row.rowNumber,
        recipientName: row.recipientName,
        companyName: row.companyName,
        destination: row.destination,
        reference1: row.reference1,
        requestedServiceCode: row.requestedServiceCode,
        requestedServiceName: matchedRate.serviceName,
        accountNumber: matchedRate.accountNumber,
        accountLabel: matchedRate.accountLabel,
        carrierCost: matchedRate.carrierCost,
        customerPrice: matchedRate.customerPrice,
        status: "quoted",
        message: result.source === "fallback" ? result.diagnostic : undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "UPS batch quote failed.";

      return {
        rowNumber: row.rowNumber,
        recipientName: row.recipientName,
        companyName: row.companyName,
        destination: row.destination,
        reference1: row.reference1,
        requestedServiceCode: row.requestedServiceCode,
        requestedServiceName: row.requestedServiceName,
        status: "error",
        message
      };
    }
  });

  const quotedRows = rows.filter((row) => row.status === "quoted");
  const response = {
    rows,
    totals: {
      rowCount: rows.length,
      quotedCount: quotedRows.length,
      errorCount: rows.length - quotedRows.length,
      carrierCostTotal: quotedRows.reduce((sum, row) => sum + (row.carrierCost ?? 0), 0),
      customerPriceTotal: quotedRows.reduce((sum, row) => sum + (row.customerPrice ?? 0), 0)
    },
    note: "UPS batch preview only. Uploading a template lets you review per-row prices and totals before balance deduction and label purchase are added."
  } satisfies UpsBatchPreviewResponse;

  return NextResponse.json(response);
}
