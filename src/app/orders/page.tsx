export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { getStoredOrders } from "@/lib/orders";
import { requireUser } from "@/lib/auth/session";

export default async function OrdersPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const orders = await getStoredOrders(user.id);

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Stored orders</p>
        <h1>CALFIE EXPRESS order history</h1>
        <p className="muted">These are the orders currently persisted in PostgreSQL for your signed-in customer account.</p>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Status</th>
              <th>Service</th>
              <th>Customer amount</th>
              <th>Tracking</th>
              <th>Label ready</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.status}</td>
                <td>{order.selectedService}</td>
                <td>${Number(order.quotedCustomerAmount).toFixed(2)}</td>
                <td>{order.trackingNumber ?? "Pending"}</td>
                <td>{order.labelUrl ? "Yes" : "No"}</td>
                <td><Link href={`/orders/${order.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}