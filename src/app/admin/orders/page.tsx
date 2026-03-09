import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { getAllStoredOrders } from "@/lib/orders";

export default async function AdminOrdersPage() {
  const orders = await getAllStoredOrders();

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Admin orders</p>
        <h1>Stored UPS purchases</h1>
        <p className="muted">Admin-facing list of persisted orders, payment status, and available labels.</p>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Service</th>
              <th>Tracking</th>
              <th>Label</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.user.email}</td>
                <td>{order.status}</td>
                <td>{order.selectedService}</td>
                <td>{order.trackingNumber ?? "Pending"}</td>
                <td>{order.labelUrl ? "Ready" : "Missing"}</td>
                <td><Link href={`/orders/${order.id}`}>Inspect</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}