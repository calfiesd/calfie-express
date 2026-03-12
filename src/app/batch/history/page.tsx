import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { CustomerBatchesTable } from "@/components/batch/customer-batches-table";
import { requireUser } from "@/lib/auth/session";
import { getBatchPurchasesForUser } from "@/lib/batch-purchases";

export const dynamic = "force-dynamic";

export default async function BatchHistoryPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const batches = await getBatchPurchasesForUser(user.id);

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Batch history</p>
        <h1>UPS batch purchase history</h1>
        <p className="muted">Filter by status, retry lineage, recipient, order, tracking, or notes to find the exact wallet batch run faster.</p>
      </section>

      <CustomerBatchesTable batches={batches} />
    </>
  );
}
