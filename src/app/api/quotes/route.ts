import { NextResponse } from "next/server";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { demoShipment } from "@/lib/mock-data";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/config";

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
  const fedexRates = await new FedExAdapter().getRates(shipment, pricingProfile);
  const rates = [...upsResult.rates, ...fedexRates].sort((left, right) => left.customerPrice - right.customerPrice);
  const fedexConfigured = Boolean(env.FEDEX_API_KEY && env.FEDEX_SECRET_KEY && env.FEDEX_ACCOUNT_NUMBER);
  const fedexDiagnostic = fedexConfigured
    ? "FedEx live rating is enabled when your credentials and account are valid. If no live rates return, the app falls back to demo comparison pricing."
    : "FedEx comparison is using fallback demo pricing until FEDEX_API_KEY, FEDEX_SECRET_KEY, and FEDEX_ACCOUNT_NUMBER are configured.";

  return NextResponse.json({
    shipment,
    rates,
    source: upsResult.mode,
    diagnostic: [upsResult.diagnostic, fedexDiagnostic].filter(Boolean).join(" || "),
    debugAccounts: upsResult.debugAccounts,
    note: "Carrier comparison endpoint. UPS uses your single active UPS account. FedEx will use live rates when credentials are configured, otherwise fallback demo comparison pricing is shown."
  });
}
