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

  const [customers, orders, pendingAdjustments, pendingManualTopUps, batchCount] = await Promise.all([
    getAdminCustomers(),
    getAllStoredOrders(),
    prisma.carrierAdjustment.findMany({
      where: {
        status: "PENDING"
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 6
    }),
    prisma.manualTopUpRequest.findMany({
      where: {
        status: "PENDING"
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.batchPurchase.count()
  ]);
  const fedexPurchaseStatus = getFedExPurchaseStatus();

  const pendingExposure = pendingAdjustments.reduce((sum, item) => sum + Number(item.amountToCharge), 0);
  const followUpOrders = orders
    .filter((order) =>
      order.status === "PAID" ||
      order.status === "ADJUSTMENT_PENDING" ||
      order.status === "FAILED" ||
      (order.status === "LABEL_PURCHASED" && !order.labelUrl)
    )
    .slice(0, 6);
  const totalPendingManualTopUpAmount = pendingManualTopUps.reduce((sum, item) => sum + Number(item.amount), 0);

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
          <h2>Manual top-up queue</h2>
          <div className="kpi">{pendingManualTopUps.length}</div>
          <p className="muted">${totalPendingManualTopUpAmount.toFixed(2)} waiting for admin credit.</p>
          <p><Link href="/admin/customers">Open customer wallet operations</Link></p>
        </div>

        <div className="card">
          <h2>Adjustment queue</h2>
          <div className="kpi">{pendingAdjustments.length}</div>
          <p className="muted">{pendingAdjustments.length ? "Pending carrier rebills need customer billing decisions." : "No pending carrier adjustments right now."}</p>
          <p><Link href={"/admin/adjustments" as Route}>Open adjustment workflow</Link></p>
        </div>

        <div className="card">
          <h2>Order follow-up</h2>
          <div className="kpi">{followUpOrders.length}</div>
          <p className="muted">{followUpOrders.length ? "Paid, failed, or unresolved orders should be reviewed today." : "No orders currently need manual follow-up."}</p>
          <p><Link href="/admin/orders">Open admin orders</Link></p>
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
              <th>Pending top-ups</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {pendingManualTopUps.length ? pendingManualTopUps.map((request) => {
              const customer = customers.find((item) => item.id === request.userId);
              return (
                <tr key={request.id}>
                  <td>{request.id}</td>
                  <td>{customer?.companyName || customer?.email || request.userId}</td>
                  <td>${Number(request.amount).toFixed(2)}</td>
                  <td>{request.paymentMethod}</td>
                  <td>{request.reference || request.note || "No reference supplied"}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5}>No pending manual top-up requests.</td>
              </tr>
            )}
          </tbody>
        </table>
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
              <th>Orders needing follow-up</th>
              <th>Customer</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {followUpOrders.length ? followUpOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.user.email}</td>
                <td>{order.selectedCarrier}</td>
                <td>{order.status}</td>
                <td>${Number(order.quotedCustomerAmount).toFixed(2)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>No paid, failed, or unresolved orders need follow-up.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
