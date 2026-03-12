import { NextResponse } from "next/server";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { demoShipment } from "@/lib/mock-data";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to request carrier quotes." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const shipment = {
    ...(body?.shipment ?? demoShipment),
    userId: user.id
  };
  const pricingProfile = {
    userId: user.id,
    markupPercent: Number(user.pricingProfile.markupPercent),
    flatFee: Number(user.pricingProfile.flatFee),
    minimumProfit: Number(user.pricingProfile.minimumProfit),
    residentialSurcharge: Number(user.pricingProfile.residentialSurcharge),
    signatureSurcharge: Number(user.pricingProfile.signatureSurcharge)
  };

  const allowUps = user.pricingProfile.allowUps !== false;
  const allowFedex = user.pricingProfile.allowFedex !== false;

  const upsResult = allowUps
    ? await new UpsAdapter().getRatesWithDiagnostics(shipment, pricingProfile)
    : { rates: [], mode: "disabled", diagnostic: "UPS is disabled for this customer.", debugAccounts: [] };

  const fedexResult = allowFedex
    ? await new FedExAdapter().getRatesWithDiagnostics(shipment, pricingProfile)
    : { rates: [], status: { mode: "disabled", diagnostic: "FedEx is disabled for this customer." } };

  const rates = [...upsResult.rates, ...fedexResult.rates].sort((left, right) => left.customerPrice - right.customerPrice);
  const storedQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      status: "PRICED",
      shipFromPostalCode: shipment.shipFrom.postalCode,
      shipToPostalCode: shipment.shipTo.postalCode,
      shipDate: shipment.shipDate ? new Date(shipment.shipDate) : undefined,
      packageLength: shipment.packageLength,
      packageWidth: shipment.packageWidth,
      packageHeight: shipment.packageHeight,
      packageWeight: shipment.packageWeight,
      declaredValue: shipment.declaredValue,
      residential: shipment.residential,
      signatureRequired: shipment.signatureRequired,
      shipmentJson: shipment,
      ratesJson: rates
    }
  });

  return NextResponse.json({
    quoteId: storedQuote.id,
    shipment,
    rates,
    source: upsResult.mode,
    diagnostic: [upsResult.diagnostic, fedexResult.status.diagnostic].filter(Boolean).join(" || "),
    debugAccounts: upsResult.debugAccounts,
    fedexStatus: fedexResult.status,
    note: "Carrier comparison endpoint. Customer carrier access rules can disable UPS or FedEx per account."
  });
}
