import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getLaunchReadinessReport } from "@/lib/launch-readiness";

export const dynamic = "force-dynamic";

function tone(status: "ready" | "warning" | "blocked") {
  if (status === "ready") {
    return { color: "#116149" };
  }
  if (status === "warning") {
    return { color: "#8a5a00" };
  }
  return { color: "#a12622" };
}

export default async function AdminLaunchPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }

  const report = await getLaunchReadinessReport();

  return (
    <>
      <SiteNav />
      <section className="section hero">
        <div>
          <p className="eyebrow">Production readiness</p>
          <h1>Go-live audit and release checklist</h1>
          <p className="copy">
            This page checks the current environment, rollout flags, and operational risk areas so production launch decisions are based on the real app state instead of memory.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin">Back to admin</Link>
            <Link className="button" href="/admin/carriers">Carrier status</Link>
            <Link className="button" href="/admin/reconciliation">Reconciliation</Link>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="muted">Blocked items</div>
            <div className="kpi" style={tone("blocked")}>{report.summary.blockedCount}</div>
            <div className="muted">Issues that should stop a production launch.</div>
          </div>
          <div className="card">
            <div className="muted">Warnings</div>
            <div className="kpi" style={tone("warning")}>{report.summary.warningCount}</div>
            <div className="muted">Items to consciously accept or fix before go-live.</div>
          </div>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h2>Admins</h2>
          <p className="kpi">{report.facts.adminCount}</p>
          <p className="muted">Real admin accounts with access to customer, carrier, and reconciliation tools.</p>
        </div>
        <div className="card">
          <h2>Customers</h2>
          <p className="kpi">{report.facts.customerCount}</p>
          <p className="muted">Customer accounts currently stored in the production-like database.</p>
        </div>
        <div className="card">
          <h2>Orders</h2>
          <p className="kpi">{report.facts.orderCount}</p>
          <p className="muted">Stored orders available for launch-day smoke testing and support review.</p>
        </div>
        <div className="card">
          <h2>Stored labels</h2>
          <p className="kpi">{report.facts.labelCount}</p>
          <p className="muted">Labels currently persisted into the app-served storage path.</p>
        </div>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.area}>
                <td>{item.area}</td>
                <td style={tone(item.status)}>{item.status.toUpperCase()}</td>
                <td>{item.summary}</td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Release sequence</h2>
          <ol className="list muted">
            <li>Set production environment variables and real HTTPS app URL.</li>
            <li>Run `npx prisma migrate deploy` against production.</li>
            <li>Verify Stripe webhook delivery to `/api/webhooks/stripe`.</li>
            <li>Smoke-test registration, saved card, quote, purchase, wallet, and admin pages.</li>
            <li>Keep FedEx purchase disabled until a successful production drill is confirmed.</li>
          </ol>
        </div>
        <div className="card">
          <h2>Known production caveats</h2>
          <ol className="list muted">
            <li>Carrier voids are still manual-first even though refund handling is built into the app.</li>
            <li>FedEx purchase rollout is gated and should stay controlled until production validation is complete.</li>
            <li>Label durability depends on the configured storage backend shown in the readiness table.</li>
            <li>Email is optional, but support visibility is better when Postmark is configured.</li>
          </ol>
        </div>
      </section>
    </>
  );
}
