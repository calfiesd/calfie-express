import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminReconciliationSnapshot } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const rangeOptions = [7, 30, 90] as const;

export default async function AdminReconciliationPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }

  const { days: rawDays } = await searchParams;
  const requestedDays = Number.parseInt(rawDays ?? "30", 10);
  const snapshot = await getAdminReconciliationSnapshot(requestedDays);

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Admin reconciliation</p>
          <h1>Orders, wallet, and adjustment exposure in one view</h1>
          <p className="copy">
            This page brings together operational totals, wallet liability, and the newest exceptions so billing issues do not hide across multiple admin screens.
          </p>
          <div className="actions">
            {rangeOptions.map((days) => (
              <Link
                key={days}
                className={days === snapshot.days ? "button primary" : "button"}
                href={`/admin/reconciliation?days=${days}`}
              >
                Last {days} days
              </Link>
            ))}
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Quoted revenue</div>
            <div className="kpi">{money(snapshot.metrics.quotedRevenue)}</div>
            <div className="muted">Across {snapshot.metrics.orderCount} orders since {new Date(snapshot.startDate).toLocaleDateString("en-US")}</div>
          </div>
          <div className="card">
            <div className="muted">Wallet liability</div>
            <div className="kpi">{money(snapshot.metrics.walletLiability)}</div>
            <div className="muted">Customer balance still held in stored wallet funds</div>
          </div>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h2>Margin</h2>
          <p className="kpi">{money(snapshot.metrics.grossMargin)}</p>
          <p className="muted">Quoted revenue minus actual carrier cost captured so far.</p>
        </div>
        <div className="card">
          <h2>Open adjustments</h2>
          <p className="kpi">{snapshot.metrics.openAdjustmentCount}</p>
          <p className="muted">{money(snapshot.metrics.openAdjustmentAmount)} still unresolved.</p>
        </div>
        <div className="card">
          <h2>Paid without label</h2>
          <p className="kpi">{snapshot.metrics.paidWithoutLabelCount}</p>
          <p className="muted">Orders with captured payment that still need fulfillment follow-up.</p>
        </div>
        <div className="card">
          <h2>Wallet failures</h2>
          <p className="kpi">{snapshot.metrics.walletFailureCount}</p>
          <p className="muted">Failed wallet ledger events currently retained in the database.</p>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h2>Collections mix</h2>
          <ul className="list muted">
            <li>Stripe collected: {money(snapshot.metrics.stripeCollected)}</li>
            <li>Wallet collected: {money(snapshot.metrics.walletCollected)}</li>
            <li>Label-purchased/completed orders: {snapshot.metrics.labelPurchasedCount}</li>
            <li>Failed orders: {snapshot.metrics.failedOrderCount}</li>
          </ul>
        </div>
        <div className="card">
          <h2>Wallet inflow/outflow</h2>
          <ul className="list muted">
            <li>Top-ups: {money(snapshot.metrics.topUps)}</li>
            <li>Wallet purchases: {money(snapshot.metrics.walletPurchases)}</li>
            <li>Void refunds: {money(snapshot.metrics.walletRefunds)}</li>
          </ul>
        </div>
        <div className="card">
          <h2>Manual wallet actions</h2>
          <ul className="list muted">
            <li>Manual credits: {money(snapshot.metrics.manualCredits)}</li>
            <li>Manual debits: {money(snapshot.metrics.manualDebits)}</li>
            <li>Quoted carrier cost: {money(snapshot.metrics.quotedCarrierCost)}</li>
          </ul>
        </div>
        <div className="card">
          <h2>What to review</h2>
          <ul className="list muted">
            <li>Open adjustments should move to billed, paid, or waived promptly.</li>
            <li>Paid orders without labels usually mean carrier purchase follow-up is needed.</li>
            <li>Wallet liability should stay understandable relative to recent top-up activity.</li>
          </ul>
        </div>
      </section>

      <section className="section table">
        <h2>Orders Needing Attention</h2>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Carrier</th>
              <th>Amount</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.ordersNeedingAttention.length ? snapshot.ordersNeedingAttention.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/orders/${order.id}`}>{order.id}</Link></td>
                <td>{order.customer}</td>
                <td>{order.status}</td>
                <td>{order.carrier} / {order.service}</td>
                <td>{money(order.quotedCustomerAmount)}</td>
                <td>{formatDate(order.updatedAt)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No orders currently need reconciliation follow-up.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section table">
        <h2>Open Adjustments</h2>
        <table>
          <thead>
            <tr>
              <th>Adjustment</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.openAdjustments.length ? snapshot.openAdjustments.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td><Link href={`/orders/${item.orderId}`}>{item.orderId}</Link></td>
                <td>{item.customer}</td>
                <td>{item.status}</td>
                <td>{item.reason}</td>
                <td>{money(item.amountToCharge)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No unresolved adjustments.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section grid-2">
        <div className="card table">
          <h2>Recent Wallet Activity</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentWalletTransactions.length ? snapshot.recentWalletTransactions.map((item) => (
                <tr key={item.id}>
                  <td>{item.customer}</td>
                  <td>{item.type}</td>
                  <td>{money(item.amount)}</td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4}>No wallet transactions in this window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card table">
          <h2>Largest Customer Wallet Balances</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.customersWithStoredBalance.length ? snapshot.customersWithStoredBalance.map((item) => (
                <tr key={item.id}>
                  <td>{item.customer}</td>
                  <td>{money(item.balance)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={2}>No positive customer wallet balances right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
