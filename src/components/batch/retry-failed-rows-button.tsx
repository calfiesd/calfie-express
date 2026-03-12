"use client";

import { useState } from "react";

type Props = {
  batchId: string;
  disabled?: boolean;
};

export function RetryFailedRowsButton({ batchId, disabled }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retryFailedRows() {
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/batch/ups/retry-failed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ batchId })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.message ?? `Retry failed with status ${response.status}.`);
      setPending(false);
      return;
    }

    setMessage(payload?.note ?? "Retry batch created.");
    setPending(false);
    window.location.reload();
  }

  return (
    <div>
      <button className="button" type="button" onClick={retryFailedRows} disabled={disabled || pending}>
        {pending ? "Retrying failed rows..." : "Retry failed rows"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
