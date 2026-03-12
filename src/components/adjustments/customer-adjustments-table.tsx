"use client";

import { CSSProperties, useMemo, useState } from "react";

type CustomerAdjustmentRow = {
  id: string;
  status: "PENDING" | "BILLED" | "PAID" | "FAILED" | "WAIVED";
  carrierCode: "UPS" | "FEDEX";
  reason: string;
  originalQuotedAmount: number;
  carrierBilledAmount: number;
  amountToCharge: number;
  createdAt: string;
  order: {
    id: string;
    status: string;
    selectedCarrier: "UPS" | "FEDEX";
    selectedService: string;
    trackingNumber: string | null;
  };
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

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export function CustomerAdjustmentsTable({ adjustments }: { adjustments: CustomerAdjustmentRow[] }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const statuses = ["ALL", ...Array.from(new Set(adjustments.map((row) => row.status)))];
  const filteredAdjustments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return adjustments.filter((row) => {
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      const haystack = [
        row.id,
        row.order.id,
        row.reason,
        row.status,
        row.order.selectedService,
        row.order.trackingNumber ?? ""
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [adjustments, query, statusFilter]);

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
            placeholder="Search by adjustment, order, tracking, reason, or service"
            style={inputStyle}
          />
        </label>
      </div>

      <p className="muted" style={{ marginTop: "16px" }}>
        Showing {filteredAdjustments.length} of {adjustments.length} adjustments.
      </p>

      <div className="table" style={{ marginTop: "16px" }}>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Order</th>
              <th>Reason</th>
              <th>Quoted</th>
              <th>Carrier billed</th>
              <th>Customer charge</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdjustments.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>
                  <div>{row.order.id}</div>
                  <div className="muted">
                    {row.order.selectedCarrier} {row.order.selectedService}
                    {row.order.trackingNumber ? ` - ${row.order.trackingNumber}` : ""}
                  </div>
                </td>
                <td>{row.reason}</td>
                <td>{money(row.originalQuotedAmount)}</td>
                <td>{money(row.carrierBilledAmount)}</td>
                <td>{money(row.amountToCharge)}</td>
                <td>{row.status}</td>
              </tr>
            ))}
            {filteredAdjustments.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No adjustments match the current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
