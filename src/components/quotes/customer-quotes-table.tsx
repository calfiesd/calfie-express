"use client";

import Link from "next/link";
import { CSSProperties, useMemo, useState } from "react";

type QuoteRow = {
  id: string;
  status: string;
  shipFromPostalCode: string;
  shipToPostalCode: string;
  packageWeight: number;
  createdAt: string;
  ratesCount: number;
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

export function CustomerQuotesTable({ quotes }: { quotes: QuoteRow[] }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const statuses = ["ALL", ...Array.from(new Set(quotes.map((quote) => quote.status)))];
  const filteredQuotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return quotes.filter((quote) => {
      const matchesStatus = statusFilter === "ALL" || quote.status === statusFilter;
      const haystack = [
        quote.id,
        quote.shipFromPostalCode,
        quote.shipToPostalCode,
        quote.status
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [quotes, query, statusFilter]);

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
            placeholder="Search by quote or ZIP code"
            style={inputStyle}
          />
        </label>
      </div>

      <p className="muted" style={{ marginTop: "16px" }}>
        Showing {filteredQuotes.length} of {quotes.length} quotes.
      </p>

      <div className="table" style={{ marginTop: "16px" }}>
        <table>
          <thead>
            <tr>
              <th>Quote ID</th>
              <th>Status</th>
              <th>Lane</th>
              <th>Weight</th>
              <th>Rates</th>
              <th>Created</th>
              <th>Reuse</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotes.map((quote) => (
              <tr key={quote.id}>
                <td>{quote.id}</td>
                <td>{quote.status}</td>
                <td>{quote.shipFromPostalCode} {"->"} {quote.shipToPostalCode}</td>
                <td>{quote.packageWeight} lb</td>
                <td>{quote.ratesCount}</td>
                <td>{new Date(quote.createdAt).toLocaleString()}</td>
                <td>
                  <Link href={`/dashboard?quoteId=${quote.id}`}>Load on dashboard</Link>
                </td>
              </tr>
            ))}
            {filteredQuotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No quotes match the current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
