import { prisma } from "@/lib/db";
import { env } from "@/lib/config";
import { getStripeStatus } from "@/lib/payments/stripe";
import { getUpsPurchaseStatus, getUpsVoidStatus } from "@/lib/carriers/ups";
import { getFedExPurchaseStatus, getFedExVoidStatus } from "@/lib/carriers/fedex";

type ReadinessItem = {
  area: string;
  status: "ready" | "warning" | "blocked";
  summary: string;
  detail: string;
};

function makeItem(area: string, status: ReadinessItem["status"], summary: string, detail: string): ReadinessItem {
  return { area, status, summary, detail };
}

export async function getLaunchReadinessReport() {
  const stripe = getStripeStatus();
  const upsPurchase = getUpsPurchaseStatus();
  const fedexPurchase = getFedExPurchaseStatus();
  const upsVoid = getUpsVoidStatus();
  const fedexVoid = getFedExVoidStatus();

  const [adminCount, customerCount, orderCount, labelCount, walletUserCount, adjustmentCount] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.order.count(),
    prisma.order.count({
      where: {
        labelUrl: {
          startsWith: "/stored-labels/"
        }
      }
    }),
    prisma.user.count({
      where: {
        walletBalance: {
          gt: 0
        }
      }
    }),
    prisma.carrierAdjustment.count()
  ]);

  const items: ReadinessItem[] = [
    makeItem(
      "Database",
      env.DATABASE_URL ? "ready" : "blocked",
      env.DATABASE_URL ? "Database URL configured." : "Database URL missing.",
      env.DATABASE_URL ? "Production deploys still need `prisma migrate deploy` during release." : "Set a production PostgreSQL `DATABASE_URL` before deploying."
    ),
    makeItem(
      "App URL",
      env.NEXT_PUBLIC_APP_URL.startsWith("https://") ? "ready" : "warning",
      `App URL: ${env.NEXT_PUBLIC_APP_URL}`,
      env.NEXT_PUBLIC_APP_URL.startsWith("https://")
        ? "HTTPS base URL is set for production-style redirects and links."
        : "Base URL is not HTTPS. Replace it with the real production domain before go-live."
    ),
    makeItem(
      "UPS",
      upsPurchase.enabled ? "ready" : "warning",
      upsPurchase.diagnostic,
      upsVoid.enabled ? upsVoid.diagnostic : `${upsVoid.diagnostic} Refund operations currently rely on manual carrier confirmation.`
    ),
    makeItem(
      "FedEx",
      fedexPurchase.enabled ? "ready" : "warning",
      fedexPurchase.diagnostic,
      fedexPurchase.enabled
        ? `${fedexVoid.diagnostic} Run a real production purchase/void drill before broad rollout.`
        : "FedEx quoting can still work while purchase remains guarded. Leave the flag off until production validation is complete."
    ),
    makeItem(
      "Stripe",
      stripe.configured && stripe.publishableKeyPresent && stripe.webhookSecretPresent ? "ready" : "blocked",
      stripe.configured ? "Stripe secret key is configured." : "Stripe secret key is missing.",
      stripe.configured && stripe.publishableKeyPresent && stripe.webhookSecretPresent
        ? "Saved cards, wallet top-ups, checkout, and webhook fulfillment are configured."
        : "Stripe production go-live requires secret, publishable, and webhook secrets together."
    ),
    makeItem(
      "Email",
      env.POSTMARK_SERVER_TOKEN && env.POSTMARK_FROM_EMAIL ? "ready" : "warning",
      env.POSTMARK_SERVER_TOKEN && env.POSTMARK_FROM_EMAIL ? "Postmark email delivery is configured." : "Postmark is not fully configured.",
      env.POSTMARK_SERVER_TOKEN && env.POSTMARK_FROM_EMAIL
        ? "Operational notifications and customer emails can send in production."
        : "The app will run without email, but customer notifications and adjustment emails will stay silent."
    ),
    makeItem(
      "Label storage",
      env.LABEL_STORAGE_BACKEND === "vercel_blob" && env.BLOB_READ_WRITE_TOKEN ? "ready" : "warning",
      env.LABEL_STORAGE_BACKEND === "vercel_blob" && env.BLOB_READ_WRITE_TOKEN
        ? `Label storage is configured for Vercel Blob. ${labelCount} stored labels are already tracked in app records.`
        : `${labelCount} stored labels currently live under /public/stored-labels.`,
      env.LABEL_STORAGE_BACKEND === "vercel_blob" && env.BLOB_READ_WRITE_TOKEN
        ? "Object storage is configured for multi-instance production deployment."
        : "Label persistence is still local filesystem based. For durable multi-instance production, set LABEL_STORAGE_BACKEND=vercel_blob and BLOB_READ_WRITE_TOKEN."
    ),
    makeItem(
      "Wallet liability",
      walletUserCount > 0 ? "warning" : "ready",
      `${walletUserCount} customers currently hold wallet balance.`,
      walletUserCount > 0
        ? "Before launch, confirm refund and reconciliation procedures for stored customer funds."
        : "No outstanding wallet liability is currently stored."
    ),
    makeItem(
      "Admin coverage",
      adminCount > 0 ? "ready" : "blocked",
      `${adminCount} admin accounts, ${customerCount} customer accounts, ${orderCount} orders.`,
      adminCount > 0
        ? `${adjustmentCount} adjustment records are stored for ongoing support and finance review.`
        : "Create at least one real admin account before release."
    )
  ];

  return {
    summary: {
      blockedCount: items.filter((item) => item.status === "blocked").length,
      warningCount: items.filter((item) => item.status === "warning").length,
      readyCount: items.filter((item) => item.status === "ready").length
    },
    facts: {
      adminCount,
      customerCount,
      orderCount,
      labelCount,
      walletUserCount,
      adjustmentCount
    },
    items
  };
}
