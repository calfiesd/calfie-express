"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import type { UpsBatchPreviewResponse } from "@/lib/domain-types";

const buttonBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  border: "1px solid rgba(29, 36, 48, 0.12)",
  font: "inherit",
  lineHeight: "1",
  textDecoration: "none"
} as const;

const primaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#bb512f",
  borderColor: "#bb512f",
  color: "#ffffff"
} as const;

const disabledPrimaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#d7c6b4",
  borderColor: "#d7c6b4",
  color: "#fff7ef",
  cursor: "not-allowed"
} as const;

const secondaryPanelStyle = {
  padding: "18px 20px",
  borderRadius: "20px",
  border: "1px solid rgba(29, 36, 48, 0.12)",
  background: "rgba(255, 250, 242, 0.96)",
  boxShadow: "0 12px 32px rgba(57, 41, 19, 0.08)"
} as const;

function money(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

type UpsBatchClientProps = {
  customerEmail: string;
};

export function UpsBatchClient({ customerEmail }: UpsBatchClientProps) {
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UpsBatchPreviewResponse | null>(null);

  const summaryCards = useMemo(() => {
    if (!result) {
      return null;
    }

    return [
      { label: "Rows", value: String(result.totals.rowCount) },
      { label: "Quoted", value: String(result.totals.quotedCount) },
      { label: "Errors", value: String(result.totals.errorCount) },
      { label: "Customer total", value: money(result.totals.customerPriceTotal) },
      { label: "Carrier total", value: money(result.totals.carrierCostTotal) }
    ];
  }, [result]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setErrorMessage(null);

    if (!file) {
      setFileName("");
      setCsvText("");
      return;
    }

    setFileName(file.name);
    setCsvText(await file.text());
  }

  async function previewBatch() {
    if (!csvText.trim()) {
      setErrorMessage("Upload the UPS CSV file before previewing rates.");
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/batch/ups/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ csvText })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setErrorMessage(payload?.message ?? `Batch preview failed with status ${response.status}.`);
        return;
      }

      const payload = (await response.json()) as UpsBatchPreviewResponse;
      setResult(payload);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">UPS batch shipping</p>
          <h1>Upload the UPS CSV template and preview batch pricing</h1>
          <p className="copy">
            This first pass is built around your current UPS-compatible CSV format. Upload the file, review each row, and confirm the total before we add prepaid balance deduction and one-click batch label purchase.
          </p>
        </div>
        <div className="card">
          <div className="muted">Signed in customer</div>
          <div className="kpi" style={{ fontSize: "24px" }}>{customerEmail}</div>
          <div className="muted">UPS batch preview currently uses your customer pricing profile and your primary UPS account.</div>
        </div>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Upload batch file</h2>
          <p className="muted">Use the UPS CSV format you already exported from the batch shipping template. The current version expects the first 33 UPS columns to stay in place.</p>
          <div className="field">
            <span>CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
          </div>
          {fileName ? <p className="muted">Loaded file: {fileName}</p> : null}
          <div className="actions">
            <button type="button" style={isPending ? disabledPrimaryButtonStyle : primaryButtonStyle} disabled={isPending} onClick={previewBatch}>
              {isPending ? "Previewing batch..." : "Preview UPS batch"}
            </button>
          </div>
          {errorMessage ? <p className="muted">{errorMessage}</p> : null}
          {result ? <p className="muted">{result.note}</p> : null}
        </div>

        <div style={secondaryPanelStyle}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>Batch notes</p>
          <h2 style={{ marginBottom: "10px" }}>Preview first, deduct balance later</h2>
          <ul className="list muted" style={{ marginTop: 0 }}>
            <li>Rows that fail validation stay in the preview with an error instead of breaking the whole upload.</li>
            <li>This page only previews UPS prices for now. It does not deduct customer credit or buy labels yet.</li>
            <li>Address line 2 and 3 from your UPS template are folded into the destination address automatically.</li>
          </ul>
        </div>
      </section>

      {summaryCards ? (
        <section className="section grid-4">
          {summaryCards.map((card) => (
            <div className="card" key={card.label}>
              <div className="muted">{card.label}</div>
              <div className="kpi" style={{ fontSize: "24px" }}>{card.value}</div>
            </div>
          ))}
        </section>
      ) : null}

      {result ? (
        <section className="section table">
          <table>
            <thead>
              <tr>
                <th>Row</th>
                <th>Recipient</th>
                <th>Destination</th>
                <th>Requested service</th>
                <th>Billing account</th>
                <th>Status</th>
                <th>Carrier cost</th>
                <th>Customer price</th>
                <th>Reference</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>
                    <div>{row.recipientName}</div>
                    {row.companyName ? <div className="muted">{row.companyName}</div> : null}
                  </td>
                  <td>{row.destination}</td>
                  <td>{row.requestedServiceName}</td>
                  <td>{row.accountLabel ?? row.accountNumber ?? "-"}</td>
                  <td>{row.status}</td>
                  <td>{money(row.carrierCost)}</td>
                  <td>{money(row.customerPrice)}</td>
                  <td>{row.reference1 ?? "-"}</td>
                  <td>{row.message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

