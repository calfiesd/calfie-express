import { NextResponse } from "next/server";
import { UpsAdapter } from "@/lib/carriers/ups";
import { demoShipment } from "@/lib/mock-data";
import { requireUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to request UPS quotes." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const shipment = {
    ...(body?.shipment ?? demoShipment),
    userId: user.id
  };
  const result = await new UpsAdapter().getRatesWithDiagnostics(shipment, {
    userId: user.id,
    markupPercent: Number(user.pricingProfile.markupPercent),
    flatFee: Number(user.pricingProfile.flatFee),
    minimumProfit: Number(user.pricingProfile.minimumProfit),
    residentialSurcharge: Number(user.pricingProfile.residentialSurcharge),
    signatureSurcharge: Number(user.pricingProfile.signatureSurcharge)
  });

  return NextResponse.json({
    shipment,
    rates: result.rates,
    source: result.mode,
    diagnostic: result.diagnostic,
    note: "UPS-first quote endpoint. Returns live UPS rates when available, otherwise demo fallback pricing with diagnostics."
  });
}