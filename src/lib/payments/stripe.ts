import { demoCustomer } from "@/lib/mock-data";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";

type StripeUser = {
  id: string;
  email: string;
  name: string;
  companyName?: string | null;
  stripeCustomerId?: string | null;
};

export type PaymentMethodSummary = {
  mode: "live" | "demo" | "misconfigured";
  customerId?: string | null;
  paymentMethodId?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  funding?: string | null;
};

let stripeModulePromise: Promise<typeof import("stripe")> | null = null;
let stripeClient: import("stripe").default | null = null;

async function getStripeModule() {
  stripeModulePromise ??= import("stripe");
  return stripeModulePromise;
}

async function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }

  const { default: Stripe } = await getStripeModule();
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil"
  });

  return stripeClient;
}

async function ensureStripeCustomer(user?: StripeUser) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return demoCustomer.stripeCustomerId ?? "cus_demo";
  }

  if (!user) {
    const customer = await stripe.customers.create({
      email: demoCustomer.email,
      name: demoCustomer.name
    });
    return customer.id;
  }

  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (!("deleted" in customer && customer.deleted)) {
        return customer.id;
      }
    } catch (error) {
      const isMissingCustomer =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "resource_missing";

      if (!isMissingCustomer) {
        throw error;
      }
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      calfieUserId: user.id,
      companyName: user.companyName ?? ""
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customer.id
    }
  });

  return customer.id;
}

export function getStripeStatus() {
  return {
    configured: Boolean(env.STRIPE_SECRET_KEY),
    publishableKeyPresent: Boolean(env.STRIPE_PUBLISHABLE_KEY),
    webhookSecretPresent: Boolean(env.STRIPE_WEBHOOK_SECRET)
  };
}

export async function createSetupIntent(user?: StripeUser) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      mode: "demo",
      clientSecret: "seti_demo_secret",
      customerId: demoCustomer.stripeCustomerId ?? "cus_demo"
    };
  }

  const customerId = await ensureStripeCustomer(user);
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session"
  });

  return {
    mode: "live",
    clientSecret: setupIntent.client_secret,
    customerId,
    setupIntentId: setupIntent.id
  };
}

export async function retrieveSetupIntent(setupIntentId: string) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      mode: "demo" as const,
      id: setupIntentId,
      status: "succeeded",
      customerId: demoCustomer.stripeCustomerId ?? "cus_demo",
      paymentMethodId: "pm_demo_card"
    };
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  return {
    mode: "live" as const,
    id: setupIntent.id,
    status: setupIntent.status,
    customerId: typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id ?? null,
    paymentMethodId: typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id ?? null
  };
}

export async function getDefaultPaymentMethodSummary(user?: StripeUser & { defaultPaymentMethod?: string | null }): Promise<PaymentMethodSummary | null> {
  const stripe = await getStripeClient();

  if (!stripe) {
    return user?.defaultPaymentMethod || user?.stripeCustomerId
      ? {
          mode: "demo",
          customerId: user?.stripeCustomerId ?? demoCustomer.stripeCustomerId ?? "cus_demo",
          paymentMethodId: user?.defaultPaymentMethod ?? "pm_demo_card",
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
          funding: "credit"
        }
      : null;
  }

  if (!user?.stripeCustomerId || !user.defaultPaymentMethod) {
    return null;
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(user.defaultPaymentMethod);

  if (!paymentMethod || paymentMethod.type !== "card" || !paymentMethod.card) {
    return {
      mode: "live",
      customerId: user.stripeCustomerId,
      paymentMethodId: paymentMethod.id
    };
  }

  return {
    mode: "live",
    customerId: user.stripeCustomerId,
    paymentMethodId: paymentMethod.id,
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
    funding: paymentMethod.card.funding
  };
}

export async function createPaymentIntent(args: { amount: number; orderId: string; user?: StripeUser }) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      paymentMode: "demo" as const,
      clientSecret: "pi_demo_secret",
      paymentIntentId: `pi_demo_${Date.now()}`,
      status: "demo_ready" as const,
      currency: "usd" as const,
      amount: args.amount
    };
  }

  const customerId = await ensureStripeCustomer(args.user);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(args.amount * 100),
    currency: "usd",
    customer: customerId,
    automatic_payment_methods: {
      enabled: true
    },
    metadata: {
      calfieOrderId: args.orderId,
      ...(args.user
        ? {
            calfieUserId: args.user.id,
            calfieUserEmail: args.user.email
          }
        : {})
    }
  });

  return {
    paymentMode: "live" as const,
    clientSecret: paymentIntent.client_secret ?? "",
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status === "requires_payment_method" ? "requires_payment_method" : "requires_confirmation",
    currency: "usd" as const,
    amount: args.amount
  };
}

export async function createWalletPaymentIntent(args: { amount: number; user: StripeUser }) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      paymentMode: "demo" as const,
      clientSecret: "pi_wallet_demo_secret",
      paymentIntentId: `pi_wallet_demo_${Date.now()}`,
      status: "demo_ready" as const,
      currency: "usd" as const,
      amount: args.amount
    };
  }

  const customerId = await ensureStripeCustomer(args.user);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(args.amount * 100),
    currency: "usd",
    customer: customerId,
    automatic_payment_methods: {
      enabled: true
    },
    metadata: {
      calfieWalletTopUp: "true",
      calfieUserId: args.user.id,
      calfieUserEmail: args.user.email,
      calfieWalletAmount: args.amount.toFixed(2)
    }
  });

  return {
    paymentMode: "live" as const,
    clientSecret: paymentIntent.client_secret ?? "",
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status === "requires_payment_method" ? "requires_payment_method" : "requires_confirmation",
    currency: "usd" as const,
    amount: args.amount
  };
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const stripe = await getStripeClient();

  if (!stripe) {
    const fallbackAmount = Number(paymentIntentId.split("_").pop() ?? 0);
    return {
      mode: "demo" as const,
      id: paymentIntentId,
      status: "succeeded" as const,
      amount: fallbackAmount > 0 ? fallbackAmount : undefined,
      metadata: {}
    };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return {
    mode: "live" as const,
    id: paymentIntent.id,
    status: paymentIntent.status,
    amount: typeof paymentIntent.amount_received === "number" && paymentIntent.amount_received > 0
      ? paymentIntent.amount_received / 100
      : paymentIntent.amount / 100,
    metadata: paymentIntent.metadata
  };
}

export async function constructStripeWebhookEvent(payload: string, signature: string) {
  const stripe = await getStripeClient();

  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured.");
  }

  return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function createAdjustmentCharge(args: {
  customerId?: string;
  user?: StripeUser;
  amount: number;
  reason: string;
  adjustmentId?: string;
  orderId?: string;
}) {
  const stripe = await getStripeClient();
  const customerId = args.customerId ?? await ensureStripeCustomer(args.user);

  if (!stripe) {
    return {
      mode: "demo",
      customerId,
      amount: args.amount,
      reason: args.reason,
      status: "queued"
    };
  }

  const invoiceItem = await stripe.invoiceItems.create({
    customer: customerId,
    amount: Math.round(args.amount * 100),
    currency: "usd",
    description: args.reason,
    metadata: {
      ...(args.adjustmentId ? { calfieAdjustmentId: args.adjustmentId } : {}),
      ...(args.orderId ? { calfieOrderId: args.orderId } : {}),
      ...(args.user ? { calfieUserId: args.user.id } : {})
    }
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    auto_advance: true,
    metadata: {
      ...(args.adjustmentId ? { calfieAdjustmentId: args.adjustmentId } : {}),
      ...(args.orderId ? { calfieOrderId: args.orderId } : {}),
      ...(args.user ? { calfieUserId: args.user.id } : {})
    }
  });
  if (!invoice.id) {
    throw new Error("Stripe invoice creation did not return an invoice ID.");
  }

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

  return {
    mode: "live",
    customerId,
    invoiceId: finalizedInvoice.id,
    invoiceItemId: invoiceItem.id,
    status: finalizedInvoice.status ?? "open"
  };
}

export async function refundPaymentIntent(args: {
  paymentIntentId: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      mode: "demo" as const,
      refundId: `re_demo_${Date.now()}`,
      status: "succeeded" as const
    };
  }

  const refund = await stripe.refunds.create({
    payment_intent: args.paymentIntentId,
    ...(args.reason ? { reason: args.reason } : {})
  });

  return {
    mode: "live" as const,
    refundId: refund.id,
    status: refund.status ?? "pending"
  };
}
