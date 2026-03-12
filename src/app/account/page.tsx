export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AccountSettingsClient } from "@/components/account/account-settings-client";
import { requireUser } from "@/lib/auth/session";

export default async function AccountPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Account settings</p>
        <h1>Profile and password</h1>
        <p className="muted">
          Keep your contact details current and rotate your own password without waiting for admin support.
        </p>
      </section>

      <AccountSettingsClient
        profile={{
          id: user.id,
          email: user.email,
          name: user.name,
          companyName: user.companyName
        }}
      />
    </>
  );
}
