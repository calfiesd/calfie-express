import Link from "next/link";
import type { Route } from "next";
import { getSessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

export async function SiteNav() {
  const user = await getSessionUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="nav">
      <div className="brand">
        <span className="brand-badge">CE</span>
        <div>
          <div>CALFIE EXPRESS</div>
          <div className="muted">Private-rate label portal</div>
        </div>
      </div>
      <div className="nav-links">
        <Link href="/">Home</Link>
        {user ? <Link href="/dashboard">Customer Portal</Link> : <Link href="/login">Login</Link>}
        {user ? <Link href="/wallet">Wallet</Link> : null}
        {user ? <Link href={"/quotes" as Route}>Quotes</Link> : null}
        {user ? <Link href={"/account" as Route}>Account</Link> : null}
        {user ? <Link href={"/payments" as Route}>Payments</Link> : null}
        {user ? <Link href={"/adjustments" as Route}>Adjustments</Link> : null}
        {user ? <Link href="/addresses">Addresses</Link> : null}
        {user ? <Link href="/batch/ups">UPS Batch</Link> : null}
        {user ? <Link href="/batch/history">Batch History</Link> : null}
        {user ? <Link href="/orders">Orders</Link> : null}
        {isAdmin ? <Link href="/admin">Admin</Link> : null}
        {isAdmin ? <Link href="/admin/orders">Admin Orders</Link> : null}
        {isAdmin ? <Link href={"/admin/adjustments" as Route}>Admin Adjustments</Link> : null}
        {isAdmin ? <Link href="/admin/customers">Admin Customers</Link> : null}
        {isAdmin ? <Link href="/admin/batches">Admin Batches</Link> : null}
        {isAdmin ? <Link href="/admin/carriers">Carrier Status</Link> : null}
        {isAdmin ? <Link href="/admin/launch">Launch Readiness</Link> : null}
        {isAdmin ? <Link href="/admin/reconciliation">Reconciliation</Link> : null}
        {user ? <span className="muted">{user.email}</span> : null}
        {user ? <LogoutButton /> : null}
      </div>
    </div>
  );
}
