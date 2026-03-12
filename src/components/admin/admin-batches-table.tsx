"use client";

import Link from "next/link";
import { CSSProperties, useState } from "react";
import type { UpsBatchPreviewResponse } from "@/lib/domain-types";
import { downloadCsv } from "@/components/admin/csv-export";

type AdminBatchRow = {
  id: string;
  fingerprint: string;
  rowCount: number;
  totalAmount: number;
  status: string;
  sourceCsvPresent: boolean;
  retryOfBatchId: string | null;
  createdAt: string;
  updatedAt: string;
  result: UpsBatchPreviewResponse | null;
  user: {
    id: string;
    email: string;
    name: string;
    companyName: string | null;
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

function money(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export function AdminBatchesTable({ batches }: { batches: AdminBatchRow[] }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [retryFilter, setRetryFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const statuses = ["ALL", ...Array.from(new Set(batches.map((batch) => batch.status)))];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBatches = batches.filter((batch) => {
    const matchesStatus = statusFilter === "ALL" || batch.status === statusFilter;
    const matchesRetry =
      retryFilter === "ALL" ||
      (retryFilter === "RETRIES" && Boolean(batch.retryOfBatchId)) ||
      (retryFilter === "ORIGINALS" && !batch.retryOfBatchId) ||
      (retryFilter === "FAILED_ROWS" && (batch.result?.totals.failedCount ?? 0) > 0);
    const haystack = [
      batch.id,
      batch.user.email,
      batch.user.name,
      batch.user.companyName ?? "",
      batch.fingerprint,
      batch.retryOfBatchId ?? "",
      batch.status
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
    return matchesStatus && matchesRetry && matchesQuery;
  });

  function exportFilteredBatches() {
    downloadCsv("admin-batches.csv", [
      "batch_id",
      "customer_email",
      "customer_name",
      "company_name",
      "status",
      "row_count",
      "customer_total",
      "purchased_count",
      "failed_count",
      "retry_of_batch_id",
      "fingerprint",
      "created_at"
    ], filteredBatches.map((batch) => ([
      batch.id,
      batch.user.email,
      batch.user.name,
      batch.user.companyName,
      batch.status,
      batch.rowCount,
      batch.result?.totals.customerPriceTotal ?? batch.totalAmount,
      batch.result?.totals.purchasedCount ?? 0,
      batch.result?.totals.failedCount ?? 0,
      batch.retryOfBatchId,
      batch.fingerprint,
      batch.createdAt
    ])));
  }

  return (
    <section className="section card">
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "minmax(200px, 240px) minmax(200px, 240px) minmax(260px, 1fr)" }}>
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
          <div className="eyebrow" style={{ marginBottom: "8px" }}>Batch type</div>
          <select value={retryFilter} onChange={(event) => setRetryFilter(event.target.value)} style={inputStyle}>
            <option value="ALL">All batches</option>
            <option value="ORIGINALS">Original batches</option>
            <option value="RETRIES">Retries only</option>
            <option value="FAILED_ROWS">With failed rows</option>
          </select>
        </label>
        <label>
          <div className="eyebrow" style={{ marginBottom: "8px" }}>Search</div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer, batch ID, fingerprint, or retry source"
            style={inputStyle}
          />
        </label>
      </div>

      <p className="muted" style={{ marginTop: "16px" }}>
        Showing {filteredBatches.length} of {batches.length} batch runs.
      </p>
      <div className="actions" style={{ marginTop: "16px" }}>
        <button className="button" type="button" onClick={exportFilteredBatches} disabled={filteredBatches.length === 0}>
          Export filtered CSV
        </button>
      </div>

      <div className="table" style={{ marginTop: "16px" }}>
        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Purchased</th>
              <th>Failed</th>
              <th>Retry of</th>
              <th>Fingerprint</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.id}</td>
                <td>
                  <div>{batch.user.companyName || batch.user.name || batch.user.email}</div>
                  <div className="muted">{batch.user.email}</div>
                </td>
                <td>{batch.status}</td>
                <td>{money(batch.result?.totals.customerPriceTotal ?? batch.totalAmount)}</td>
                <td>{batch.result?.totals.purchasedCount ?? 0}</td>
                <td>{batch.result?.totals.failedCount ?? 0}</td>
                <td>{batch.retryOfBatchId ?? "-"}</td>
                <td><code>{batch.fingerprint.slice(0, 12)}</code></td>
                <td>{new Date(batch.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">No batch runs match the current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {filteredBatches.map((batch) => (
        <section className="card" key={`${batch.id}-detail`} style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <p className="eyebrow">Batch {batch.id}</p>
              <h2 style={{ marginBottom: "8px" }}>{batch.user.companyName || batch.user.name || batch.user.email}</h2>
              <p className="muted" style={{ margin: 0 }}>{batch.user.email}</p>
              <p className="muted" style={{ margin: 0 }}>Created {new Date(batch.createdAt).toLocaleString()}</p>
              <p className="muted" style={{ margin: 0 }}>Fingerprint: <code>{batch.fingerprint}</code></p>
              {batch.retryOfBatchId ? <p className="muted" style={{ margin: 0 }}>Retry of batch {batch.retryOfBatchId}</p> : null}
            </div>
            <div>
              <p className="muted" style={{ margin: 0 }}>Customer total: {money(batch.result?.totals.customerPriceTotal ?? batch.totalAmount)}</p>
              <p className="muted" style={{ margin: 0 }}>Purchased rows: {batch.result?.totals.purchasedCount ?? 0}</p>
              <p className="muted" style={{ margin: 0 }}>Failed rows: {batch.result?.totals.failedCount ?? 0}</p>
            </div>
          </div>

          <div className="table" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Customer price</th>
                  <th>Order</th>
                  <th>Tracking</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {batch.result?.rows?.length ? batch.result.rows.map((row) => (
                  <tr key={`${batch.id}-${row.rowNumber}`}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <div>{row.recipientName}</div>
                      {row.companyName ? <div className="muted">{row.companyName}</div> : null}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.requestedServiceName}</td>
                    <td>{money(row.customerPrice)}</td>
                    <td>{row.orderId ? <Link href={`/orders/${row.orderId}`}>{row.orderId}</Link> : "-"}</td>
                    <td>{row.trackingNumber ?? "-"}</td>
                    <td>
                      {row.labelUrl ? <a href={row.labelUrl} target="_blank">Open label</a> : null}
                      {row.message ? <div className="muted">{row.message}</div> : row.labelUrl ? null : "-"}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>No stored row details for this batch.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
}
