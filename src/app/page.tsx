import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <section className="hero">
        <div>
          <p className="eyebrow">Production shipping operations</p>
          <h1>CALFIE EXPRESS customer label platform with wallet and batch operations</h1>
          <p className="copy">
            The platform now supports customer-specific pricing, wallet-funded checkout, live UPS purchase,
            live FedEx rate comparison, admin recovery tools, and UPS batch buying with duplicate protection,
            retry flows, and stored history.
          </p>
          <div className="actions">
            <Link className="button primary" href="/dashboard">Open customer portal</Link>
            <Link className="button" href="/admin">Open admin dashboard</Link>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Carrier coverage</div>
            <div className="kpi">UPS + FedEx</div>
            <div className="muted">UPS purchase is live and FedEx quotes are live, with purchase guarded behind the live-label safety switch.</div>
          </div>
          <div className="card">
            <div className="muted">Stored value</div>
            <div className="kpi">Wallet</div>
            <div className="muted">Customers can preload balance, buy labels from wallet, and receive automatic wallet refunds for voids and failed batch rows.</div>
          </div>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h3>Customer pricing</h3>
          <p className="muted">Each customer account has its own markup percent, flat fee, and minimum profit floor.</p>
        </div>
        <div className="card">
          <h3>Carrier access</h3>
          <p className="muted">Admins can enable or disable UPS and FedEx quote and purchase access per customer account.</p>
        </div>
        <div className="card">
          <h3>Wallet + Stripe</h3>
          <p className="muted">Stripe funds the wallet, while checkout can run from either stored wallet balance or card payment flows.</p>
        </div>
        <div className="card">
          <h3>Batch operations</h3>
          <p className="muted">UPS CSV uploads support quote preview, wallet purchase, duplicate blocking, retry of failed rows, and audit history.</p>
        </div>
      </section>
    </>
  );
}
