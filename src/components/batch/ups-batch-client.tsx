"use client";

import Link from "next/link";
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
  initialWalletBalance: number;
};

export function UpsBatchClient({ customerEmail, initialWalletBalance }: UpsBatchClientProps) {
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [isPending, setIsPending] = useState(false);
  const [isPurchasePending, setIsPurchasePending] = useState(false);
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
      { label: "Purchased", value: String(result.totals.purchasedCount ?? 0) },
      { label: "Failed", value: String(result.totals.failedCount ?? 0) },
      { label: "Customer total", value: money(result.totals.customerPriceTotal) },
      { label: "Carrier total", value: money(result.totals.carrierCostTotal) },
      { label: "Wallet balance", value: money(walletBalance) }
    ];
  }, [result, walletBalance]);

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

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setErrorMessage(payload?.message ?? `Batch preview failed with status ${response.status}.`);
        return;
      }

      setResult(payload as UpsBatchPreviewResponse);
    } finally {
      setIsPending(false);
    }
  }

  async function purchaseBatch() {
    if (!csvText.trim()) {
      setErrorMessage("Upload the UPS CSV file before buying labels.");
      return;
    }

    setIsPurchasePending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/batch/ups/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ csvText })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.rows) {
        setErrorMessage(payload?.message ?? payload?.note ?? `Batch purchase failed with status ${response.status}.`);
        if (payload?.rows && payload?.totals) {
          setResult(payload as UpsBatchPreviewResponse);
        }
        return;
      }

      const nextResult = payload as UpsBatchPreviewResponse;
      setResult(nextResult);
      const spent = nextResult.rows
        .filter((row) => row.status === "purchased")
        .reduce((sum, row) => sum + (row.customerPrice ?? 0), 0);
      const refundedFailures = nextResult.rows
        .filter((row) => row.status === "failed")
        .reduce((sum, row) => sum + (row.customerPrice ?? 0), 0);
      setWalletBalance((current) => Number((current - spent + refundedFailures).toFixed(2)));
    } finally {
      setIsPurchasePending(false);
    }
  }

  const hasBlockingErrors = (result?.totals.errorCount ?? 0) > 0;
  const hasPurchaseOutcome = ((result?.totals.purchasedCount ?? 0) + (result?.totals.failedCount ?? 0)) > 0;
  const walletCanCoverPreview = walletBalance >= (result?.totals.customerPriceTotal ?? Number.POSITIVE_INFINITY);
  const canPurchase = Boolean(
    result &&
    result.totals.quotedCount > 0 &&
    !hasBlockingErrors &&
    !hasPurchaseOutcome &&
    walletCanCoverPreview &&
    !isPurchasePending
  );

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">UPS batch shipping</p>
          <h1>Upload the UPS CSV template and buy labels from prepaid balance</h1>
          <p className="copy">
            Upload the file, review each row, confirm the batch total, then charge the customer wallet and create UPS labels in one batch workflow.
          </p>
        </div>
        <div className="card">
          <div className="muted">Signed in customer</div>
          <div className="kpi" style={{ fontSize: "24px" }}>{customerEmail}</div>
          <div className="muted">Wallet available: {money(walletBalance)}</div>
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
            <button type="button" style={canPurchase ? primaryButtonStyle : disabledPrimaryButtonStyle} disabled={!canPurchase} onClick={purchaseBatch}>
              {isPurchasePending ? "Buying labels..." : "Buy quoted rows from wallet"}
            </button>
          </div>
          {result && !walletCanCoverPreview ? <p className="muted">Wallet balance does not cover this batch total. Add funds at <Link href="/wallet">/wallet</Link>.</p> : null}
          {result && hasPurchaseOutcome ? <p className="muted">This preview has already been used for a batch purchase attempt. Re-preview the CSV before buying again.</p> : null}
          {errorMessage ? <p className="muted">{errorMessage}</p> : null}
          {result ? <p className="muted">{result.note}</p> : null}
        </div>

        <div style={secondaryPanelStyle}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>Batch notes</p>
          <h2 style={{ marginBottom: "10px" }}>Preview, re-quote, then charge wallet</h2>
          <ul className="list muted" style={{ marginTop: 0 }}>
            <li>The server re-quotes every row again during purchase so wallet deductions are based on fresh UPS prices.</li>
            <li>The batch will not start if any row has a quote error or the wallet balance is below the quoted total.</li>
            <li>If a row fails after wallet charge, that row is refunded back to wallet and marked failed in the batch results.</li>
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
                <th>Order</th>
                <th>Tracking</th>
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
                  <td>{row.orderId ? <Link href={`/orders/${row.orderId}`}>{row.orderId}</Link> : "-"}</td>
                  <td>{row.trackingNumber ?? "-"}</td>
                  <td>{row.reference1 ?? "-"}</td>
                  <td>
                    {row.labelUrl ? <a href={row.labelUrl} target="_blank">Open label</a> : null}
                    {row.message ? <div className="muted">{row.message}</div> : row.labelUrl ? null : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}
