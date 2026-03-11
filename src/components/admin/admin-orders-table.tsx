"use client";

import Link from "next/link";
import { CSSProperties, useState } from "react";

type AdminOrderRow = {
  id: string;
  user: { email: string };
  status: string;
  selectedService: string;
  trackingNumber: string | null;
  labelUrl: string | null;
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "16px",
  border: "1px solid #d8ccb8",
  background: "#f7f4ed",
  padding: "0.9rem 1rem",
  fontSize: "1rem",
  color: "#1f2a44"
};

export function AdminOrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const statuses = ["ALL", ...Array.from(new Set(orders.map((order) => order.status)))];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    const haystack = [order.id, order.user.email, order.selectedService, order.trackingNumber ?? "", order.status]
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="section card">
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "minmax(220px, 280px) minmax(260px, 1fr)" }}>
        <label>
          <div className="eyebrow" style={{ marginBottom: "8px" }}>Status filter</div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="eyebrow" style={{ marginBottom: "8px" }}>Search</div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by order, customer, tracking, service, or status"
            style={inputStyle}
          />
        </label>
      </div>

      <p className="muted" style={{ marginTop: "16px" }}>
        Showing {filteredOrders.length} of {orders.length} orders.
      </p>

      <div className="table" style={{ marginTop: "16px" }}>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Service</th>
              <th>Tracking</th>
              <th>Label</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.user.email}</td>
                <td>{order.status}</td>
                <td>{order.selectedService}</td>
                <td>{order.trackingNumber ?? "Pending"}</td>
                <td>{order.labelUrl ? "Ready" : "Missing"}</td>
                <td>
                  <Link href={`/orders/${order.id}`}>Inspect</Link>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No orders match the current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}