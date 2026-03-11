export const dynamic = "force-dynamic";

import { SiteNav } from "@/components/site-nav";
import { CustomerManagement } from "@/components/admin/customer-management";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminCustomers } from "@/lib/customers";
import { redirect } from "next/navigation";

export default async function AdminCustomersPage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/login");
  }

  const customers = await getAdminCustomers();

  const normalizedCustomers = customers.map((customer) => ({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    companyName: customer.companyName,
    pricingProfile: customer.pricingProfile
      ? {
          markupPercent: Number(customer.pricingProfile.markupPercent),
          flatFee: Number(customer.pricingProfile.flatFee),
          minimumProfit: Number(customer.pricingProfile.minimumProfit),
          residentialSurcharge: Number(customer.pricingProfile.residentialSurcharge),
          signatureSurcharge: Number(customer.pricingProfile.signatureSurcharge),
          enabled: customer.pricingProfile.enabled,
          allowUps: customer.pricingProfile.allowUps !== false,
          allowFedex: customer.pricingProfile.allowFedex !== false
        }
      : null,
    _count: customer._count,
    orders: customer.orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      status: order.status
    }))
  }));

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Admin customers</p>
          <h1>Manage customer pricing and account status</h1>
          <p className="copy">
            Update markup rules, disable customer pricing when needed, and control which carriers each customer can quote.
          </p>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Customer accounts</div>
            <div className="kpi">{normalizedCustomers.length}</div>
            <div className="muted">Signed-up customer profiles in PostgreSQL</div>
          </div>
          <div className="card">
            <div className="muted">Profiles enabled</div>
            <div className="kpi">{normalizedCustomers.filter((customer) => customer.pricingProfile?.enabled !== false).length}</div>
            <div className="muted">Customers currently allowed to quote and buy labels</div>
          </div>
        </div>
      </section>

      <CustomerManagement customers={normalizedCustomers} />
    </>
  );
}
