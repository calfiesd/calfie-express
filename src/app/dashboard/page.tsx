export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { getStripeStatus } from "@/lib/payments/stripe";
import { env } from "@/lib/config";
import { requireUser } from "@/lib/auth/session";
import type { UpsDebugAccount, UpsQuoteResponse } from "@/lib/domain-types";

export default async function DashboardPage() {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    redirect("/login");
  }

  const pricingSummary = {
    markupPercent: Number(user.pricingProfile.markupPercent),
    flatFee: Number(user.pricingProfile.flatFee),
    minimumProfit: Number(user.pricingProfile.minimumProfit),
    residentialSurcharge: Number(user.pricingProfile.residentialSurcharge),
    signatureSurcharge: Number(user.pricingProfile.signatureSurcharge),
    userId: user.id
  };

  const initialShipment = {
    ...demoShipment,
    userId: user.id,
    shipFrom: {
      ...demoShipment.shipFrom,
      name: user.companyName || user.name,
      company: user.companyName || user.name,
      email: user.email
    }
  };

  const ups = await new UpsAdapter().getRatesWithDiagnostics(initialShipment, pricingSummary);
  const fedexRates = await new FedExAdapter().getRates(initialShipment, pricingSummary);
  const stripe = getStripeStatus();
  const initialRates = [...ups.rates, ...fedexRates].sort((left, right) => left.customerPrice - right.customerPrice);
  const fedexDiagnostic = fedexRates.length > 0
    ? "FedEx comparison is enabled with placeholder account-rate logic until live FedEx API credentials are connected."
    : "FedEx comparison returned no rates.";
  const upsDebugAccounts = (ups as { debugAccounts?: UpsDebugAccount[] }).debugAccounts;

  const initialQuote = {
    shipment: initialShipment,
    rates: initialRates,
    source: ups.mode,
    diagnostic: [ups.diagnostic, fedexDiagnostic].filter(Boolean).join(" || "),
    debugAccounts: upsDebugAccounts,
    note: "Initial dashboard comparison load"
  } as UpsQuoteResponse;

  return (
    <>
      <SiteNav />
      <DashboardClient
        initialShipment={initialShipment}
        initialQuote={initialQuote}
        stripeConfigured={stripe.configured}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
        pricingSummary={{
          markupPercent: pricingSummary.markupPercent,
          flatFee: pricingSummary.flatFee,
          minimumProfit: pricingSummary.minimumProfit
        }}
        customerEmail={user.email}
      />
    </>
  );
}
