export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { demoShipment } from "@/lib/mock-data";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { getFedExPurchaseStatus } from "@/lib/carriers/fedex";
import { getStripeStatus } from "@/lib/payments/stripe";
import { env } from "@/lib/config";
import { requireUser } from "@/lib/auth/session";
import { getSavedAddresses } from "@/lib/addresses";
import { getCustomerAdjustmentSummary } from "@/lib/adjustments";
import { getWalletSummary } from "@/lib/wallet";
import { getStoredQuoteById } from "@/lib/quotes";
import type { UpsDebugAccount, UpsQuoteResponse } from "@/lib/domain-types";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ quoteId?: string }> }) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    redirect("/login");
  }

  const { quoteId } = await searchParams;
  const pricingSummary = {
    markupPercent: Number(user.pricingProfile.markupPercent),
    flatFee: Number(user.pricingProfile.flatFee),
    minimumProfit: Number(user.pricingProfile.minimumProfit),
    residentialSurcharge: Number(user.pricingProfile.residentialSurcharge),
    signatureSurcharge: Number(user.pricingProfile.signatureSurcharge),
    userId: user.id
  };

  const defaultShipment = {
    ...demoShipment,
    userId: user.id,
    shipFrom: {
      ...demoShipment.shipFrom,
      name: user.companyName || user.name,
      company: user.companyName || user.name,
      email: user.email
    }
  };
  const storedQuote = quoteId ? await getStoredQuoteById(quoteId, user.id) : null;
  const initialShipment = (storedQuote?.shipmentJson as typeof defaultShipment | null) ?? defaultShipment;

  const [ups, fedexResult, wallet, savedAddresses, adjustmentSummary, stripe] = await Promise.all([
    new UpsAdapter().getRatesWithDiagnostics(initialShipment, pricingSummary),
    new FedExAdapter().getRatesWithDiagnostics(initialShipment, pricingSummary),
    getWalletSummary(user.id),
    getSavedAddresses(user.id),
    getCustomerAdjustmentSummary(user.id),
    Promise.resolve(getStripeStatus())
  ]);
  const fedexPurchaseStatus = getFedExPurchaseStatus();
  const initialRates = [...ups.rates, ...fedexResult.rates].sort((left, right) => left.customerPrice - right.customerPrice);
  const upsDebugAccounts = (ups as { debugAccounts?: UpsDebugAccount[] }).debugAccounts;

  const initialQuote = {
    quoteId: storedQuote?.id,
    shipment: initialShipment,
    rates: storedQuote?.ratesJson && Array.isArray(storedQuote.ratesJson)
      ? (storedQuote.ratesJson as UpsQuoteResponse["rates"])
      : initialRates,
    source: ups.mode,
    diagnostic: storedQuote
      ? "Loaded from stored quote history."
      : [ups.diagnostic, fedexResult.status.diagnostic].filter(Boolean).join(" || "),
    debugAccounts: upsDebugAccounts,
    fedexStatus: fedexResult.status,
    note: storedQuote ? "Loaded stored quote from quote history." : "Initial dashboard comparison load"
  } as UpsQuoteResponse;

  return (
    <>
      <SiteNav />
      <DashboardClient
        initialShipment={initialShipment}
        initialQuote={initialQuote}
        stripeConfigured={stripe.configured}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
        customerEmail={user.email}
        initialWalletBalance={wallet?.balance ?? Number(user.walletBalance ?? 0)}
        initialSavedAddresses={savedAddresses}
        initialAdjustmentSummary={adjustmentSummary}
        fedexPurchaseStatus={fedexPurchaseStatus}
      />
    </>
  );
}
