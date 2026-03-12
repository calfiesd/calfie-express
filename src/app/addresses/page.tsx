export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AddressBookClient } from "@/components/addresses/address-book-client";
import { requireUser } from "@/lib/auth/session";
import { getSavedAddresses } from "@/lib/addresses";

export default async function AddressesPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const addresses = await getSavedAddresses(user.id);

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Saved addresses</p>
        <h1>Customer address book</h1>
        <p className="muted">Create and manage saved recipients for faster quoting and label creation.</p>
      </section>

      <AddressBookClient initialAddresses={addresses} />
    </>
  );
}
