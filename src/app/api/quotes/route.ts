import { NextResponse } from "next/server";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { demoShipment } from "@/lib/mock-data";
import { requireUser } from "@/lib/auth/session";

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

  const upsResult = await new UpsAdapter().getRatesWithDiagnostics(shipment, pricingProfile);
  const fedexResult = await new FedExAdapter().getRatesWithDiagnostics(shipment, pricingProfile);
  const rates = [...upsResult.rates, ...fedexResult.rates].sort((left, right) => left.customerPrice - right.customerPrice);

  return NextResponse.json({
    shipment,
    rates,
    source: upsResult.mode,
    diagnostic: [upsResult.diagnostic, fedexResult.status.diagnostic].filter(Boolean).join(" || "),
    debugAccounts: upsResult.debugAccounts,
    fedexStatus: fedexResult.status,
    note: "Carrier comparison endpoint. UPS uses your single active UPS account. FedEx status is shown explicitly as live, fallback, or misconfigured."
  });
}
