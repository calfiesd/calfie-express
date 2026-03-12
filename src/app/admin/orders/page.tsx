export const dynamic = "force-dynamic";

import { SiteNav } from "@/components/site-nav";
import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { getAllStoredOrders } from "@/lib/orders";

export default async function AdminOrdersPage() {
  const orders = await getAllStoredOrders();
  const initialOrders = orders.map((order) => ({
    id: order.id,
    user: {
      email: order.user.email
    },
    status: order.status,
    selectedCarrier: order.selectedCarrier,
    selectedService: order.selectedService,
    paymentSource: order.paymentSource,
    quotedCustomerAmount: Number(order.quotedCustomerAmount),
    quotedCarrierAmount: Number(order.quotedCarrierAmount),
    trackingNumber: order.trackingNumber,
    labelUrl: order.labelUrl,
    createdAt: order.createdAt.toISOString()
  }));

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Admin orders</p>
        <h1>Stored purchases</h1>
        <p className="muted">Filter by status or search by order, customer, service, and tracking number.</p>
      </section>

      <AdminOrdersTable orders={initialOrders} />
    </>
  );
}
