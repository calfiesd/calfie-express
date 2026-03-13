export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/lib/auth/session";
import { getStoredOrderById } from "@/lib/orders";
import { buildCommercialInvoice, isInternationalShipment } from "@/lib/international";
import type { ShipmentInput } from "@/lib/domain-types";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export default async function CommercialInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const order = await getStoredOrderById(id, user.role === "ADMIN" ? undefined : user.id);

  if (!order) {
    notFound();
  }

  const shipment = order.shipmentJson as ShipmentInput | null;
  if (!shipment || !isInternationalShipment(shipment)) {
    notFound();
  }

  const invoice = buildCommercialInvoice({
    id: order.id,
    createdAt: order.createdAt,
    quotedCustomerAmount: order.quotedCustomerAmount,
    shipmentJson: shipment
  });

  if (!invoice) {
    notFound();
  }

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Commercial invoice</p>
        <h1>{invoice.invoiceNumber}</h1>
        <p className="muted">Prepared from the shipment details saved on order {order.id}.</p>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Exporter</h2>
          <p className="muted">{shipment.shipFrom.name}</p>
          {shipment.shipFrom.company ? <p className="muted">{shipment.shipFrom.company}</p> : null}
          <p className="muted">{shipment.shipFrom.line1}</p>
          {shipment.shipFrom.line2 ? <p className="muted">{shipment.shipFrom.line2}</p> : null}
          <p className="muted">{shipment.shipFrom.city}, {shipment.shipFrom.state} {shipment.shipFrom.postalCode}</p>
          <p className="muted">{shipment.shipFrom.countryCode}</p>
          {invoice.exporterTaxId ? <p className="muted">Tax ID: {invoice.exporterTaxId}</p> : null}
        </div>

        <div className="card">
          <h2>Consignee</h2>
          <p className="muted">{shipment.shipTo.name}</p>
          {shipment.shipTo.company ? <p className="muted">{shipment.shipTo.company}</p> : null}
          <p className="muted">{shipment.shipTo.line1}</p>
          {shipment.shipTo.line2 ? <p className="muted">{shipment.shipTo.line2}</p> : null}
          <p className="muted">{shipment.shipTo.city}, {shipment.shipTo.state} {shipment.shipTo.postalCode}</p>
          <p className="muted">{shipment.shipTo.countryCode}</p>
          {invoice.importerTaxId ? <p className="muted">Tax ID: {invoice.importerTaxId}</p> : null}
        </div>
      </section>

      <section className="section grid-3">
        <div className="card">
          <h2>Invoice terms</h2>
          <p className="muted">Date: {new Date(invoice.invoiceDate).toLocaleDateString()}</p>
          <p className="muted">Reason for export: {invoice.reasonForExport || "Not provided"}</p>
          <p className="muted">Terms of sale: {invoice.termsOfSale || "Not provided"}</p>
          <p className="muted">Non-delivery option: {invoice.nonDeliveryOption}</p>
        </div>

        <div className="card">
          <h2>Shipment summary</h2>
          <p className="muted">Contents: {invoice.contentsSummary || "Not provided"}</p>
          <p className="muted">Declared value: {money(invoice.totalDeclaredValue)}</p>
          <p className="muted">Package weight: {shipment.packageWeight} lb</p>
        </div>

        <div className="card">
          <h2>Order references</h2>
          <p className="muted">Order: {order.id}</p>
          <p className="muted">Carrier: {order.selectedCarrier}</p>
          <p className="muted">Service: {order.selectedService}</p>
          <p className="muted">Tracking: {order.trackingNumber ?? "Pending"}</p>
        </div>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Origin</th>
              <th>HS code</th>
              <th>Qty</th>
              <th>Unit value</th>
              <th>Unit weight</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length ? invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.originCountryCode}</td>
                <td>{item.hsCode || "-"}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unitValue)}</td>
                <td>{item.unitWeight} lb</td>
                <td>{money(item.quantity * item.unitValue)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7}>No customs line items were saved on this order.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
