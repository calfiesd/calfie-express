export const dynamic = "force-dynamic";

import { SiteNav } from "@/components/site-nav";
import { AdminOrdersTable } from "@/components/admin/admin-orders-table";
import { getAllStoredOrders } from "@/lib/orders";

export default async function AdminOrdersPage() {
  const orders = await getAllStoredOrders();

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Admin orders</p>
        <h1>Stored purchases</h1>
        <p className="muted">Filter by status or search by order, customer, service, and tracking number.</p>
      </section>

      <AdminOrdersTable orders={orders} />
    </>
  );
}