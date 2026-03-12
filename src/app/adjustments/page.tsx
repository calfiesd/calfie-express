export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { CustomerAdjustmentsTable } from "@/components/adjustments/customer-adjustments-table";
import { requireUser } from "@/lib/auth/session";
import { getCustomerCarrierAdjustments, getCustomerAdjustmentSummary } from "@/lib/adjustments";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export default async function AdjustmentsPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const [adjustments, summary] = await Promise.all([
    getCustomerCarrierAdjustments(user.id),
    getCustomerAdjustmentSummary(user.id)
  ]);

  const rows = adjustments.map((row) => ({
    id: row.id,
    status: row.status,
    carrierCode: row.carrierCode,
    reason: row.reason,
    originalQuotedAmount: Number(row.originalQuotedAmount),
    carrierBilledAmount: Number(row.carrierBilledAmount),
    amountToCharge: Number(row.amountToCharge),
    createdAt: row.createdAt.toISOString(),
    order: {
      id: row.order.id,
      status: row.order.status,
      selectedCarrier: row.order.selectedCarrier,
      selectedService: row.order.selectedService,
      trackingNumber: row.order.trackingNumber
    }
  }));

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Carrier adjustments</p>
        <h1>Post-shipment billing history</h1>
        <p className="muted">
          Review any carrier rebills applied after label purchase. Outstanding balance: {money(summary.outstandingAmount)} across {summary.unresolvedCount} open adjustments.
        </p>
      </section>

      <CustomerAdjustmentsTable adjustments={rows} />
    </>
  );
}
