export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { OrderVoidAction } from "@/components/orders/order-void-action";
import { getStoredOrderById } from "@/lib/orders";
import { requireUser } from "@/lib/auth/session";
import { getOrderVoidGuidance } from "@/lib/carrier-operations";
import { isInternationalShipment } from "@/lib/international";
import type { ShipmentInput } from "@/lib/domain-types";

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
  const shipment = order.shipmentJson as ShipmentInput | null;
  const internationalShipment = shipment ? isInternationalShipment(shipment) : false;

  return (
    <>
      <SiteNav />
      <section className="section ops-shell">
        <div className="card">
          <div className="ops-hero">
            <div>
              <p className="eyebrow">Order detail</p>
              <h1>{order.id}</h1>
              <p className="muted">Review tracking, shipment information, reprint documents, and complete any carrier follow-up.</p>
            </div>
            <div className="ops-banner">
              <div className="muted">Current status</div>
              <div className="kpi" style={{ fontSize: "1.9rem", marginBottom: "6px" }}>{order.status}</div>
              <div className="muted">{order.selectedCarrier} {order.selectedService} {order.trackingNumber ? `• ${order.trackingNumber}` : "• Tracking pending"}</div>
            </div>
          </div>
        </div>

        <div className="ops-grid">
          <div className="ops-kpi">
            <h2>Status</h2>
            <p className="muted">Payment source: {order.paymentSource}</p>
            <p className="muted">Tracking: {order.trackingNumber ?? "Pending"}</p>
            <p className="muted">Shipment mode: {internationalShipment ? "International" : "Domestic"}</p>
          </div>
          <div className="ops-kpi">
            <h2>Pricing</h2>
            <p className="muted">Customer amount: ${Number(order.quotedCustomerAmount).toFixed(2)}</p>
            <p className="muted">Carrier amount: ${Number(order.quotedCarrierAmount).toFixed(2)}</p>
            <p className="muted">Wallet debit: ${Number(order.walletDebitedAmount ?? 0).toFixed(2)}</p>
            <p className="muted">Margin: ${Number(order.marginAmount).toFixed(2)}</p>
          </div>
        <div className="ops-kpi">
          <h2>Documents</h2>
          {order.labelUrl ? <p><a href={order.labelUrl} target="_blank">Open stored label</a></p> : <p className="muted">No label saved yet.</p>}
          {internationalShipment ? <p><Link href={`/orders/${order.id}/commercial-invoice`}>Open commercial invoice</Link></p> : <p className="muted">No customs invoice needed.</p>}
          {internationalShipment ? <p className="muted">Customs payload attached during purchase when invoice data was provided.</p> : null}
        </div>
          <div className="ops-kpi">
            <h2>Carrier follow-up</h2>
            <p className="muted">
              Carrier adjustments: {order.adjustments.length ? `${order.adjustments.filter((item) => ["PENDING", "BILLED", "FAILED"].includes(item.status)).length} open` : "None"}
            </p>
            <p className="muted">
              <a href={voidGuidance.portalUrl} target="_blank">{voidGuidance.portalLabel}</a>
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <h2>{voidGuidance.title}</h2>
            <p className="muted">{voidGuidance.summary}</p>
            <p className="muted">{voidGuidance.diagnostic}</p>
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
        </div>
      </section>

      {order.adjustments.length ? (
        <section className="section card">
          <h2>Carrier adjustments</h2>
          <div className="table is-compact">
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

      {internationalShipment && shipment?.customs ? (
        <section className="section card">
          <h2>Customs details</h2>
          <div className="grid-3">
            <div className="ops-kpi">
              <h3 style={{ marginTop: 0 }}>Export terms</h3>
              <p className="muted">Reason for export: {shipment.customs.reasonForExport || "Not provided"}</p>
              <p className="muted">Terms of sale: {shipment.customs.termsOfSale || "Not provided"}</p>
              <p className="muted">Non-delivery option: {shipment.customs.nonDeliveryOption}</p>
            </div>
            <div className="ops-kpi">
              <h3 style={{ marginTop: 0 }}>Tax references</h3>
              <p className="muted">Exporter tax ID: {shipment.customs.exporterTaxId || "Not provided"}</p>
              <p className="muted">Importer tax ID: {shipment.customs.importerTaxId || "Not provided"}</p>
              <p className="muted">Invoice number: {shipment.customs.invoiceNumber || "Auto-generated"}</p>
            </div>
            <div className="ops-kpi">
              <h3 style={{ marginTop: 0 }}>Contents</h3>
              <p className="muted">{shipment.customs.contentsSummary || "Not provided"}</p>
              <p className="muted">{shipment.customs.items.length} customs line item(s)</p>
              <p className="muted"><Link href={`/orders/${order.id}/commercial-invoice`}>Open printable invoice</Link></p>
            </div>
          </div>
          <div className="table is-compact" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Origin</th>
                  <th>HS code</th>
                  <th>Unit value</th>
                  <th>Unit weight</th>
                </tr>
              </thead>
              <tbody>
                {shipment.customs.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{item.originCountryCode}</td>
                    <td>{item.hsCode || "-"}</td>
                    <td>${Number(item.unitValue).toFixed(2)}</td>
                    <td>{Number(item.unitWeight).toFixed(2)} lb</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="section grid-2">
        <div className="card">
          <h2>Shipment record</h2>
          {shipment ? (
            <>
              <p className="muted">
                <strong>From:</strong> {shipment.shipFrom.name}, {shipment.shipFrom.city}, {shipment.shipFrom.state} {shipment.shipFrom.postalCode}
              </p>
              <p className="muted">
                <strong>To:</strong> {shipment.shipTo.name}, {shipment.shipTo.city}, {shipment.shipTo.state} {shipment.shipTo.postalCode}
              </p>
              <p className="muted">
                <strong>Package:</strong> {shipment.packageLength} x {shipment.packageWidth} x {shipment.packageHeight} in, {shipment.packageWeight} lb
              </p>
              <p className="muted">
                <strong>Declared value:</strong> ${Number(shipment.declaredValue).toFixed(2)}
              </p>
              {shipment.customs ? (
                <p className="muted">
                  <strong>Customs summary:</strong> {shipment.customs.contentsSummary || "Not provided"} • {shipment.customs.items.length} item(s)
                </p>
              ) : null}
            </>
          ) : null}
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
