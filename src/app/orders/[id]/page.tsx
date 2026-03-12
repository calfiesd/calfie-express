export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { OrderVoidAction } from "@/components/orders/order-void-action";
import { getStoredOrderById } from "@/lib/orders";
import { requireUser } from "@/lib/auth/session";
import { getOrderVoidGuidance } from "@/lib/carrier-operations";

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

  const voidGuidance = getOrderVoidGuidance({
    carrier: order.selectedCarrier,
    trackingNumber: order.trackingNumber,
    paymentSource: order.paymentSource
  });

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
          <p className="muted">Payment source: {order.paymentSource}</p>
          <p className="muted">Tracking: {order.trackingNumber ?? "Pending"}</p>
          <p className="muted">
            Carrier adjustments: {order.adjustments.length ? `${order.adjustments.filter((item) => ["PENDING", "BILLED", "FAILED"].includes(item.status)).length} open` : "None"}
          </p>
        </div>
        <div className="card">
          <h2>Pricing</h2>
          <p className="muted">Customer amount: ${Number(order.quotedCustomerAmount).toFixed(2)}</p>
          <p className="muted">Carrier amount: ${Number(order.quotedCarrierAmount).toFixed(2)}</p>
          <p className="muted">Wallet debit: ${Number(order.walletDebitedAmount ?? 0).toFixed(2)}</p>
          <p className="muted">Margin: ${Number(order.marginAmount).toFixed(2)}</p>
        </div>
        <div className="card">
          <h2>Reprint</h2>
          {order.labelUrl ? <a href={order.labelUrl} target="_blank">Open stored label</a> : <p className="muted">No label saved yet.</p>}
        </div>
        <div className="card">
          <h2>{voidGuidance.title}</h2>
          <p className="muted">{voidGuidance.summary}</p>
          <p className="muted">{voidGuidance.diagnostic}</p>
          <p className="muted">
            <a href={voidGuidance.portalUrl} target="_blank">{voidGuidance.portalLabel}</a>
          </p>
          <ol className="list muted">
            {voidGuidance.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <OrderVoidAction
          orderId={order.id}
          initialStatus={order.status}
          allowVoid={["LABEL_PURCHASED", "PAID", "VOID_REQUESTED"].includes(order.status)}
          carrierCode={order.selectedCarrier}
          trackingNumber={order.trackingNumber}
          guidanceSummary={voidGuidance.summary}
        />
      </section>

      {order.adjustments.length ? (
        <section className="section card">
          <h2>Carrier adjustments</h2>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Reason</th>
                  <th>Quoted</th>
                  <th>Billed</th>
                  <th>Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {order.adjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td>{new Date(adjustment.createdAt).toLocaleString()}</td>
                    <td>{adjustment.reason}</td>
                    <td>${Number(adjustment.originalQuotedAmount).toFixed(2)}</td>
                    <td>${Number(adjustment.carrierBilledAmount).toFixed(2)}</td>
                    <td>${Number(adjustment.amountToCharge).toFixed(2)}</td>
                    <td>{adjustment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: "16px" }}>
            Questions about these charges can be reviewed from your <Link href="/adjustments">adjustments history</Link>.
          </p>
        </section>
      ) : null}

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
