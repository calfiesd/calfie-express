import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter } from "@/lib/carriers/ups";
import { getStripeStatus } from "@/lib/payments/stripe";
import { env } from "@/lib/config";
import { requireUser } from "@/lib/auth/session";

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
  const stripe = getStripeStatus();

  return (
    <>
      <SiteNav />
      <DashboardClient
        initialShipment={initialShipment}
        initialQuote={{
          shipment: initialShipment,
          rates: ups.rates,
          source: ups.mode,
          diagnostic: ups.diagnostic,
          note: "Initial dashboard quote load"
        }}
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