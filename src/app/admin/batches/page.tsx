import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AdminBatchesTable } from "@/components/admin/admin-batches-table";
import { requireAdmin } from "@/lib/auth/session";
import { getAllBatchPurchases } from "@/lib/batch-purchases";

export const dynamic = "force-dynamic";

export default async function AdminBatchesPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login");
  }

  const batches = await getAllBatchPurchases();

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Admin batch history</p>
        <h1>Customer UPS batch runs</h1>
        <p className="muted">Filter by status, customer, batch ID, fingerprint, or retry lineage to answer support questions faster.</p>
      </section>

      <AdminBatchesTable batches={batches} />
    </>
  );
}
