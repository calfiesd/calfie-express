export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { WalletClient } from "@/components/wallet/wallet-client";
import { requireUser } from "@/lib/auth/session";
import { getWalletSummary } from "@/lib/wallet";
import { getStripeStatus } from "@/lib/payments/stripe";
import { getDefaultPaymentMethodSummary } from "@/lib/payments/stripe";
import { env } from "@/lib/config";

export default async function WalletPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const [wallet, paymentMethod] = await Promise.all([
    getWalletSummary(user.id),
    getDefaultPaymentMethodSummary({
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethod: user.defaultPaymentMethod
    })
  ]);
  const stripe = getStripeStatus();

  return (
    <>
      <SiteNav />
      <WalletClient
        initialWallet={wallet ?? { balance: 0, transactions: [] }}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
        stripeConfigured={stripe.configured}
        initialPaymentMethod={paymentMethod}
      />
    </>
  );
}
