import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <section className="hero">
        <div>
          <p className="eyebrow">Production scaffold</p>
          <h1>CALFIE EXPRESS UPS-first customer account and label platform</h1>
          <p className="copy">
            This scaffold is designed for account-only purchasing, customer-specific markup profiles,
            saved payment methods, and later rebilling when UPS posts carrier adjustments.
            FedEx can be added later without changing the customer pricing model.
          </p>
          <div className="actions">
            <Link className="button primary" href="/dashboard">Open customer portal</Link>
            <Link className="button" href="/admin">Open admin dashboard</Link>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Phase 1 carrier</div>
            <div className="kpi">UPS</div>
            <div className="muted">Launch one full carrier flow first, then add FedEx as phase 2.</div>
          </div>
          <div className="card">
            <div className="muted">Adjustment billing</div>
            <div className="kpi">Enabled</div>
            <div className="muted">Store payment methods and terms for post-shipment rebills on carrier corrections.</div>
          </div>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h3>Customer pricing</h3>
          <p className="muted">Each customer account has its own markup percent, flat fee, and minimum profit floor.</p>
        </div>
        <div className="card">
          <h3>UPS first</h3>
          <p className="muted">Rate quotes and shipment purchase are centered on UPS for the initial release.</p>
        </div>
        <div className="card">
          <h3>Payments</h3>
          <p className="muted">Stripe is used for initial payment plus later adjustment billing.</p>
        </div>
        <div className="card">
          <h3>Operations</h3>
          <p className="muted">Admins can manage pricing profiles, disputes, reprints, voids, and adjustment recovery.</p>
        </div>
      </section>
    </>
  );
}
