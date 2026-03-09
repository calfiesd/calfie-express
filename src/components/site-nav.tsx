import Link from "next/link";
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
        {user ? <Link href="/orders">Orders</Link> : null}
        {isAdmin ? <Link href="/admin">Admin</Link> : null}
        {isAdmin ? <Link href="/admin/orders">Admin Orders</Link> : null}
        {user ? <span className="muted">{user.email}</span> : null}
        {user ? <LogoutButton /> : null}
      </div>
    </div>
  );
}