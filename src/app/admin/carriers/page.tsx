import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getCarrierStatusSnapshot } from "@/lib/carrier-status";

export const dynamic = "force-dynamic";

function statusTone(enabled: boolean) {
  return {
    color: enabled ? "#116149" : "#8a3c1c",
    fontWeight: 600 as const
  };
}

export default async function AdminCarriersPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }

  const snapshot = await getCarrierStatusSnapshot();

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Carrier readiness</p>
          <h1>Live carrier status and rollout diagnostics</h1>
          <p className="copy">
            This page shows what the app can actually do right now for quoting, purchasing, and void handling across UPS, FedEx, and Stripe-backed payments.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin">Back to admin</Link>
            <Link className="button" href="/admin/reconciliation">Open reconciliation</Link>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">UPS purchase</div>
            <div className="kpi" style={statusTone(snapshot.ups.purchase.enabled)}>
              {snapshot.ups.purchase.enabled ? "Enabled" : "Guarded"}
            </div>
            <div className="muted">{snapshot.ups.purchase.diagnostic}</div>
          </div>
          <div className="card">
            <div className="muted">FedEx purchase</div>
            <div className="kpi" style={statusTone(snapshot.fedex.purchase.enabled)}>
              {snapshot.fedex.purchase.enabled ? "Enabled" : "Guarded"}
            </div>
            <div className="muted">{snapshot.fedex.purchase.diagnostic}</div>
          </div>
        </div>
      </section>

      <section className="section grid-3">
        <div className="card">
          <h2>UPS</h2>
          <ul className="list muted">
            <li>Quote mode: {snapshot.ups.quoteMode}</li>
            <li>Rates returned in smoke lookup: {snapshot.ups.rateCount}</li>
            <li>Purchase environment: {snapshot.ups.purchase.environment}</li>
            <li>Void capability: {snapshot.ups.voids.mode}</li>
          </ul>
          <p className="muted">{snapshot.ups.quoteDiagnostic}</p>
          <p className="muted">{snapshot.ups.voids.diagnostic}</p>
        </div>

        <div className="card">
          <h2>FedEx</h2>
          <ul className="list muted">
            <li>Quote mode: {snapshot.fedex.quoteMode}</li>
            <li>Rates returned in smoke lookup: {snapshot.fedex.rateCount}</li>
            <li>Purchase environment: {snapshot.fedex.purchase.environment}</li>
            <li>Void capability: {snapshot.fedex.voids.mode}</li>
          </ul>
          <p className="muted">{snapshot.fedex.quoteDiagnostic}</p>
          <p className="muted">{snapshot.fedex.voids.diagnostic}</p>
        </div>

        <div className="card">
          <h2>Stripe</h2>
          <ul className="list muted">
            <li>Secret key configured: {snapshot.stripe.configured ? "yes" : "no"}</li>
            <li>Publishable key present: {snapshot.stripe.publishableKeyPresent ? "yes" : "no"}</li>
            <li>Webhook secret present: {snapshot.stripe.webhookSecretPresent ? "yes" : "no"}</li>
          </ul>
          <p className="muted">
            Stripe setup controls whether saved cards, wallet top-ups, and post-purchase adjustment billing run in live mode or demo-safe mode.
          </p>
        </div>
      </section>
    </>
  );
}
