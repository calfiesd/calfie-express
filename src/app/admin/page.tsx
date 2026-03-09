import { SiteNav } from "@/components/site-nav";
import { demoCustomer } from "@/lib/mock-data";

const adjustmentRows = [
  {
    id: "adj_001",
    customer: demoCustomer.companyName,
    reason: "Carrier billed 3.2 lb dimensional increase",
    charge: 6.45,
    status: "Pending billing"
  },
  {
    id: "adj_002",
    customer: "Marketplace Seller",
    reason: "Address correction surcharge",
    charge: 18.2,
    status: "Paid"
  }
];

export default function AdminPage() {
  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Admin operations</p>
          <h1>Pricing, carrier, and adjustment controls</h1>
          <p className="copy">
            Admins can assign per-customer markup percentages, monitor label profitability,
            and recover carrier rebills through saved payment methods.
          </p>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Active pricing rules</div>
            <div className="kpi">42</div>
            <div className="muted">Customer-specific pricing profiles</div>
          </div>
          <div className="card">
            <div className="muted">Adjustment exposure</div>
            <div className="kpi">$24.65</div>
            <div className="muted">Pending recovery from carrier rebills</div>
          </div>
        </div>
      </section>

      <section className="section grid-3">
        <div className="card">
          <h2>Customer pricing editor</h2>
          <div className="form-grid">
            <label className="field">
              <span>Customer email</span>
              <input defaultValue={demoCustomer.email} />
            </label>
            <label className="field">
              <span>Markup percent</span>
              <input defaultValue={String(demoCustomer.pricingProfile.markupPercent)} />
            </label>
            <label className="field">
              <span>Flat fee</span>
              <input defaultValue={String(demoCustomer.pricingProfile.flatFee)} />
            </label>
            <label className="field">
              <span>Minimum profit</span>
              <input defaultValue={String(demoCustomer.pricingProfile.minimumProfit)} />
            </label>
          </div>
          <div className="actions">
            <button className="button primary" type="button">Save pricing profile</button>
          </div>
        </div>

        <div className="card">
          <h2>Credential checklist</h2>
          <ul className="list muted">
            <li>UPS OAuth credentials pending</li>
            <li>FedEx API credentials pending</li>
            <li>Stripe secret and webhook signing secret pending</li>
            <li>Email provider token pending</li>
          </ul>
        </div>

        <div className="card">
          <h2>Go-live rules</h2>
          <ul className="list muted">
            <li>Terms must authorize post-shipment adjustment charges.</li>
            <li>Customers should save a default payment method before first label purchase.</li>
            <li>Production carrier access should be tested with void and refund flows.</li>
          </ul>
        </div>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Adjustment ID</th>
              <th>Customer</th>
              <th>Reason</th>
              <th>Charge</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {adjustmentRows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.customer}</td>
                <td>{row.reason}</td>
                <td>${row.charge.toFixed(2)}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
