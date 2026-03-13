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
    walletBalance: Number(customer.walletBalance),
    walletTransactions: customer.walletTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balanceAfter),
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
      order: transaction.order
        ? {
            id: transaction.order.id,
            selectedCarrier: transaction.order.selectedCarrier,
            selectedService: transaction.order.selectedService,
            status: transaction.order.status
          }
        : null
    })),
    manualTopUpRequests: customer.manualTopUpRequests.map((request) => ({
      id: request.id,
      amount: Number(request.amount),
      paymentMethod: request.paymentMethod,
      reference: request.reference,
      note: request.note,
      status: request.status,
      processedAt: request.processedAt?.toISOString() ?? null,
      processedByAdmin: request.processedByAdmin,
      walletTransactionId: request.walletTransactionId,
      createdAt: request.createdAt.toISOString()
    })),
    pricingProfile: customer.pricingProfile
      ? {
          markupPercent: Number(customer.pricingProfile.markupPercent),
          flatFee: Number(customer.pricingProfile.flatFee),
          minimumProfit: Number(customer.pricingProfile.minimumProfit),
          residentialSurcharge: Number(customer.pricingProfile.residentialSurcharge),
          signatureSurcharge: Number(customer.pricingProfile.signatureSurcharge),
          enabled: customer.pricingProfile.enabled,
          allowUps: customer.pricingProfile.allowUps !== false,
          allowFedex: customer.pricingProfile.allowFedex !== false,
          allowUpsPurchase: customer.pricingProfile.allowUpsPurchase !== false,
          allowFedexPurchase: customer.pricingProfile.allowFedexPurchase !== false
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
            Update markup rules, disable customer pricing when needed, control carrier access, and adjust prepaid wallet balances for support and reconciliation.
          </p>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Customer accounts</div>
            <div className="kpi">{normalizedCustomers.length}</div>
            <div className="muted">Signed-up customer profiles in PostgreSQL</div>
          </div>
          <div className="card">
            <div className="muted">Wallet balance on file</div>
            <div className="kpi">${normalizedCustomers.reduce((sum, customer) => sum + customer.walletBalance, 0).toFixed(2)}</div>
            <div className="muted">Combined prepaid customer balance across all wallets</div>
          </div>
        </div>
      </section>

      <CustomerManagement customers={normalizedCustomers} />
    </>
  );
}
