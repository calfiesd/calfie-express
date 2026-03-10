import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCustomers } from "@/lib/customers";
import { getAllStoredOrders } from "@/lib/orders";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login");
  }

  const [customers, orders, pendingAdjustments] = await Promise.all([
    getAdminCustomers(),
    getAllStoredOrders(),
    prisma.carrierAdjustment.findMany({
      where: {
        status: "PENDING"
      }
    })
  ]);

  const pendingExposure = pendingAdjustments.reduce((sum, item) => sum + Number(item.amountToCharge), 0);

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Admin operations</p>
          <h1>Pricing, carrier, and adjustment controls</h1>
          <p className="copy">
            Admins can assign per-customer markup percentages, monitor label profitability, and recover carrier rebills through saved payment methods.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin/customers">Open customer management</Link>
            <Link className="button" href="/admin/orders">Review all orders</Link>
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
          <h2>Credential checklist</h2>
          <ul className="list muted">
            <li>UPS live quote and purchase connected</li>
            <li>FedEx live quote connected</li>
            <li>FedEx purchase path ready behind safety switch</li>
            <li>Stripe secret and webhook signing secret connected</li>
          </ul>
        </div>

        <div className="card">
          <h2>Go-live rules</h2>
          <ul className="list muted">
            <li>Terms must authorize post-shipment adjustment charges.</li>
            <li>Customers should save a default payment method before first label purchase.</li>
            <li>Keep FedEx live purchase behind the safety switch until production validation is complete.</li>
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
