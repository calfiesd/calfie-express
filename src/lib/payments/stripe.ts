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
    apiVersion: "2025-02-24.acacia"
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
    return user.stripeCustomerId;
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
    customerId
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
      ...(args.user ? {
        calfieUserId: args.user.id,
        calfieUserEmail: args.user.email
      } : {})
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
    return {
      mode: "demo" as const,
      id: paymentIntentId,
      status: "succeeded" as const
    };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  return {
    mode: "live" as const,
    id: paymentIntent.id,
    status: paymentIntent.status,
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
  customerId: string;
  amount: number;
  reason: string;
}) {
  const stripe = await getStripeClient();

  if (!stripe) {
    return {
      mode: "demo",
      ...args,
      status: "queued"
    };
  }

  await stripe.invoiceItems.create({
    customer: args.customerId,
    amount: Math.round(args.amount * 100),
    currency: "usd",
    description: args.reason
  });

  const invoice = await stripe.invoices.create({
    customer: args.customerId,
    collection_method: "charge_automatically"
  });

  return {
    mode: "live",
    invoiceId: invoice.id,
    status: invoice.status ?? "draft"
  };
}