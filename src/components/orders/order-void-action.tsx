"use client";

import { CSSProperties, useState } from "react";

const primaryButtonStyle: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.85rem 1.35rem",
  fontSize: "1rem",
  fontWeight: 700,
  border: "1px solid #c85c2b",
  background: "#c85c2b",
  color: "#fffdf7",
  cursor: "pointer",
  minHeight: "48px"
};

const secondaryButtonStyle: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.85rem 1.35rem",
  fontSize: "1rem",
  fontWeight: 700,
  border: "1px solid #2f5d62",
  background: "#2f5d62",
  color: "#fffdf7",
  cursor: "pointer",
  minHeight: "48px"
};

const disabledButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "#e8ddca",
  borderColor: "#e8ddca",
  color: "#fffaf0",
  cursor: "not-allowed"
};

export function OrderVoidAction(props: {
  orderId: string;
  initialStatus: string;
  allowVoid: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(props.initialStatus);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(endpoint: "void" | "refund") {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch(`/api/orders/${props.orderId}/${endpoint}`, {
      method: "POST"
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.message ?? `${endpoint} request failed with status ${response.status}.`);
      setSubmitting(false);
      return;
    }

    setStatus(payload?.status ?? status);
    setMessage(payload?.diagnostic ?? payload?.message ?? `${endpoint} request submitted.`);
    setSubmitting(false);
  }

  const canRequestVoid = props.allowVoid && status !== "REFUNDED";
  const canMarkRefunded = status === "VOID_REQUESTED";

  return (
    <div className="card">
      <h2>Void / refund</h2>
      <p className="muted">Current status: {status}</p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          style={canRequestVoid && !submitting ? primaryButtonStyle : disabledButtonStyle}
          onClick={() => submit("void")}
          disabled={!canRequestVoid || submitting}
        >
          {submitting ? "Submitting..." : "Request void / refund"}
        </button>
        <button
          type="button"
          style={canMarkRefunded && !submitting ? secondaryButtonStyle : disabledButtonStyle}
          onClick={() => submit("refund")}
          disabled={!canMarkRefunded || submitting}
        >
          {submitting ? "Submitting..." : "Mark refunded manually"}
        </button>
      </div>
      {message ? (
        <p className="muted" style={{ marginTop: "12px" }}>
          {message}
        </p>
      ) : null}
      {!props.allowVoid ? (
        <p className="muted" style={{ marginTop: "12px" }}>
          Void/refund is available only after a paid label purchase.
        </p>
      ) : null}
      {status === "VOID_REQUESTED" ? (
        <p className="muted" style={{ marginTop: "12px" }}>
          After you void the shipment in the carrier portal, use "Mark refunded manually" to close the loop.
        </p>
      ) : null}
    </div>
  );
}