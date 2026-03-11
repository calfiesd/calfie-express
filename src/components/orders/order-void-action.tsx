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

  async function requestVoid() {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch(`/api/orders/${props.orderId}/void`, {
      method: "POST"
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.message ?? `Void request failed with status ${response.status}.`);
      setSubmitting(false);
      return;
    }

    setStatus(payload?.status ?? status);
    setMessage(payload?.diagnostic ?? payload?.message ?? "Void request submitted.");
    setSubmitting(false);
  }

  return (
    <div className="card">
      <h2>Void / refund</h2>
      <p className="muted">Current status: {status}</p>
      <button
        type="button"
        style={props.allowVoid && !submitting ? primaryButtonStyle : disabledButtonStyle}
        onClick={requestVoid}
        disabled={!props.allowVoid || submitting}
      >
        {submitting ? "Submitting..." : "Request void / refund"}
      </button>
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
    </div>
  );
}