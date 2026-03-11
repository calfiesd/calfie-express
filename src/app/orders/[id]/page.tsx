export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { OrderVoidAction } from "@/components/orders/order-void-action";
import { getStoredOrderById } from "@/lib/orders";
import { requireUser } from "@/lib/auth/session";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const order = await getStoredOrderById(id, user.role === "ADMIN" ? undefined : user.id);

  if (!order) {
    notFound();
  }

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Order detail</p>
        <h1>{order.id}</h1>
        <p className="muted">Review tracking, shipment information, and re-open the label output.</p>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Status</h2>
          <p className="muted">{order.status}</p>
          <p className="muted">Tracking: {order.trackingNumber ?? "Pending"}</p>
        </div>
        <div className="card">
          <h2>Pricing</h2>
          <p className="muted">Customer amount: ${Number(order.quotedCustomerAmount).toFixed(2)}</p>
          <p className="muted">Carrier amount: ${Number(order.quotedCarrierAmount).toFixed(2)}</p>
          <p className="muted">Margin: ${Number(order.marginAmount).toFixed(2)}</p>
        </div>
        <div className="card">
          <h2>Reprint</h2>
          {order.labelUrl ? <a href={order.labelUrl} target="_blank">Open stored label</a> : <p className="muted">No label saved yet.</p>}
        </div>
        <OrderVoidAction
          orderId={order.id}
          initialStatus={order.status}
          allowVoid={["LABEL_PURCHASED", "PAID", "VOID_REQUESTED"].includes(order.status)}
        />
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Shipment data</h2>
          <pre className="code">{JSON.stringify(order.shipmentJson, null, 2)}</pre>
        </div>
        <div className="card">
          <h2>Selected rate</h2>
          <pre className="code">{JSON.stringify(order.selectedRateJson, null, 2)}</pre>
        </div>
      </section>

      <section className="section card">
        <Link href="/orders">Back to orders</Link>
      </section>
    </>
  );
}