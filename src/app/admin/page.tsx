import Link from "next/link";
import type { Route } from "next";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCustomers } from "@/lib/customers";
import { getAllStoredOrders } from "@/lib/orders";
import { prisma } from "@/lib/db";
import { getFedExPurchaseStatus } from "@/lib/carriers/fedex";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login");
  }

  const [customers, orders, pendingAdjustments, batchCount] = await Promise.all([
    getAdminCustomers(),
    getAllStoredOrders(),
    prisma.carrierAdjustment.findMany({
      where: {
        status: "PENDING"
      }
    }),
    prisma.batchPurchase.count()
  ]);
  const fedexPurchaseStatus = getFedExPurchaseStatus();

  const pendingExposure = pendingAdjustments.reduce((sum, item) => sum + Number(item.amountToCharge), 0);

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Admin operations</p>
          <h1>Pricing, carrier, and adjustment controls</h1>
          <p className="copy">
            Admins can assign per-customer markup percentages, monitor label profitability, recover carrier rebills, and audit batch purchase activity across customers.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin/customers">Open customer management</Link>
            <Link className="button" href="/admin/orders">Review all orders</Link>
            <Link className="button" href={"/admin/adjustments" as Route}>Review adjustments</Link>
            <Link className="button" href="/admin/batches">Review batch history</Link>
            <Link className="button" href="/admin/carriers">Review carrier readiness</Link>
            <Link className="button" href="/admin/launch">Review launch readiness</Link>
            <Link className="button" href="/admin/reconciliation">Open reconciliation</Link>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Active pricing rules</div>
            <div className="kpi">{customers.filter((customer) => customer.pricingProfile?.enabled !== false).length}</div>
            <div className="muted">Customer-specific pricing profiles enabled</div>
          </div>
          <div className="card">
            <div className="muted">Adjustment exposure</div>
            <div className="kpi">${pendingExposure.toFixed(2)}</div>
            <div className="muted">Pending recovery from carrier rebills</div>
          </div>
        </div>
      </section>

      <section className="section grid-3">
        <div className="card">
          <h2>Customer management</h2>
          <p className="muted">{customers.length} customer accounts currently exist in the database.</p>
          <ul className="list muted">
            {customers.slice(0, 4).map((customer) => (
              <li key={customer.id}>
                {customer.email} - {customer.pricingProfile ? `${Number(customer.pricingProfile.markupPercent)}% markup` : "No pricing profile"}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Batch activity</h2>
          <p className="muted">{batchCount} UPS batch runs are currently stored.</p>
          <ul className="list muted">
            <li>Review duplicate fingerprints and retry lineage in admin batch history.</li>
            <li>Use batch history to answer support questions without customer impersonation.</li>
          </ul>
        </div>

        <div className="card">
          <h2>Go-live rules</h2>
          <ul className="list muted">
            <li>Terms must authorize post-shipment adjustment charges.</li>
            <li>Customers should save a default payment method before first label purchase.</li>
            <li>FedEx purchase status: {fedexPurchaseStatus.diagnostic}</li>
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
            {pendingAdjustments.length ? pendingAdjustments.map((row) => {
              const customer = customers.find((item) => item.id === row.customerId);
              return (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{customer?.companyName || customer?.email || row.customerId}</td>
                  <td>{row.reason}</td>
                  <td>${Number(row.amountToCharge).toFixed(2)}</td>
                  <td>{row.status}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5}>No pending carrier adjustments.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Latest orders</th>
              <th>Customer</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 6).map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.user.email}</td>
                <td>{order.selectedCarrier}</td>
                <td>{order.status}</td>
                <td>${Number(order.quotedCustomerAmount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
