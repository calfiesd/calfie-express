export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { UpsBatchClient } from "@/components/batch/ups-batch-client";
import { requireUser } from "@/lib/auth/session";

export default async function UpsBatchPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <SiteNav />
      <UpsBatchClient customerEmail={user.email} />
    </>
  );
}
