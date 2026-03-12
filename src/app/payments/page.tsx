export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { PaymentSettingsClient } from "@/components/payments/payment-settings-client";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/config";
import { getDefaultPaymentMethodSummary, getStripeStatus } from "@/lib/payments/stripe";

export default async function PaymentsPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const [paymentMethod, stripe] = await Promise.all([
    getDefaultPaymentMethodSummary({
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethod: user.defaultPaymentMethod
    }),
    Promise.resolve(getStripeStatus())
  ]);

  return (
    <>
      <SiteNav />
      <PaymentSettingsClient
        stripeConfigured={stripe.configured}
        stripePublishableKey={env.STRIPE_PUBLISHABLE_KEY ?? ""}
        initialPaymentMethod={paymentMethod}
      />
    </>
  );
}
