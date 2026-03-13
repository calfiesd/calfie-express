export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { WalletClient } from "@/components/wallet/wallet-client";
import { requireUser } from "@/lib/auth/session";
import { getWalletSummary } from "@/lib/wallet";
import { getStripeStatus } from "@/lib/payments/stripe";
import { getDefaultPaymentMethodSummary } from "@/lib/payments/stripe";
import { env } from "@/lib/config";
import { getCustomerManualTopUpRequests } from "@/lib/manual-top-ups";

export default async function WalletPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const [wallet, paymentMethod, manualTopUpRequests] = await Promise.all([
    getWalletSummary(user.id),
    getDefaultPaymentMethodSummary({
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethod: user.defaultPaymentMethod
    }),
    getCustomerManualTopUpRequests(user.id)
  ]);
  const stripe = getStripeStatus();
  const manualTopUp = {
    enabled: env.MANUAL_TOP_UP_ENABLED,
    bankName: env.MANUAL_TOP_UP_BANK_NAME ?? "",
    accountName: env.MANUAL_TOP_UP_ACCOUNT_NAME ?? "",
    accountNumber: env.MANUAL_TOP_UP_ACCOUNT_NUMBER ?? "",
    wechatId: env.MANUAL_TOP_UP_WECHAT_ID ?? "",
    contact: env.MANUAL_TOP_UP_CONTACT ?? "",
    note: env.MANUAL_TOP_UP_NOTE ?? ""
  };

  return (
    <>
      <SiteNav />
      <WalletClient
        initialWallet={wallet ?? { balance: 0, transactions: [] }}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
        stripeConfigured={stripe.configured}
        initialPaymentMethod={paymentMethod}
        customerEmail={user.email}
        initialManualTopUpRequests={manualTopUpRequests}
        manualTopUp={manualTopUp}
      />
    </>
  );
}
