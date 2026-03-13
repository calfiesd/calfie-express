export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { getStoredOrders } from "@/lib/orders";
import { requireUser } from "@/lib/auth/session";
import { getInternationalOrderStatus } from "@/lib/orders/international-status";

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
              <th>Shipment type</th>
              <th>International status</th>
              <th>Paid with</th>
              <th>Service</th>
              <th>Customer amount</th>
              <th>Tracking</th>
              <th>Adjustments</th>
              <th>Label ready</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const internationalStatus = getInternationalOrderStatus({
                shipmentJson: order.shipmentJson as Parameters<typeof getInternationalOrderStatus>[0]["shipmentJson"],
                labelUrl: order.labelUrl,
                trackingNumber: order.trackingNumber
              });

              return (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.status}</td>
                  <td>{internationalStatus ? "International" : "Domestic"}</td>
                  <td>{internationalStatus?.summary ?? "-"}</td>
                  <td>{order.paymentSource}</td>
                  <td>{order.selectedService}</td>
                  <td>${Number(order.quotedCustomerAmount).toFixed(2)}</td>
                  <td>{order.trackingNumber ?? "Pending"}</td>
                  <td>
                    {order.adjustments.length
                      ? `${order.adjustments.filter((item) => ["PENDING", "BILLED", "FAILED"].includes(item.status)).length} open / ${order.adjustments.length} total`
                      : "None"}
                  </td>
                  <td>{order.labelUrl ? "Yes" : "No"}</td>
                  <td><Link href={`/orders/${order.id}`}>View</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
