"use client";

export function InvoiceActions() {
  return (
    <div className="actions" style={{ marginTop: 0 }}>
      <button className="button" type="button" onClick={() => window.print()}>
        Print invoice
      </button>
    </div>
  );
}
