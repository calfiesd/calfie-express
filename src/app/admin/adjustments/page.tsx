import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AdminAdjustmentsPanel } from "@/components/admin/admin-adjustments-panel";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCarrierAdjustments } from "@/lib/adjustments";
import { getAllStoredOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminAdjustmentsPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login");
  }

  const [adjustments, orders] = await Promise.all([
    getAdminCarrierAdjustments(),
    getAllStoredOrders()
  ]);

  const initialAdjustments = adjustments.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    carrierCode: row.carrierCode,
    reason: row.reason,
    originalQuotedAmount: Number(row.originalQuotedAmount),
    carrierBilledAmount: Number(row.carrierBilledAmount),
    amountToCharge: Number(row.amountToCharge),
    status: row.status,
    stripeInvoiceItemId: row.stripeInvoiceItemId,
    createdAt: row.createdAt.toISOString(),
    order: {
      id: row.order.id,
      status: row.order.status,
      selectedCarrier: row.order.selectedCarrier,
      selectedService: row.order.selectedService,
      trackingNumber: row.order.trackingNumber,
      labelUrl: row.order.labelUrl,
      quotedCarrierAmount: Number(row.order.quotedCarrierAmount),
      quotedCustomerAmount: Number(row.order.quotedCustomerAmount)
    },
    customer: {
      id: row.customer.id,
      email: row.customer.email,
      name: row.customer.name,
      companyName: row.customer.companyName,
      stripeCustomerId: row.customer.stripeCustomerId
    }
  }));

  const orderOptions = orders
    .filter((order) => order.user.role === "CUSTOMER")
    .map((order) => ({
      id: order.id,
      customerEmail: order.user.email,
      customerName: order.user.name,
      companyName: order.user.companyName,
      carrierCode: order.selectedCarrier,
      selectedService: order.selectedService,
      trackingNumber: order.trackingNumber,
      status: order.status,
      quotedCarrierAmount: Number(order.quotedCarrierAmount),
      actualCarrierAmount: order.actualCarrierAmount == null ? null : Number(order.actualCarrierAmount)
    }));

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Admin adjustments</p>
        <h1>Carrier rebills and post-shipment recovery</h1>
        <p className="muted">
          Create customer adjustments from stored orders, send Stripe invoice charges against saved customer accounts, and close out rebills when payment lands or support decides to waive them.
        </p>
      </section>

      <AdminAdjustmentsPanel initialAdjustments={initialAdjustments} orderOptions={orderOptions} />
    </>
  );
}
