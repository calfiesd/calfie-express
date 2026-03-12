"use client";

import { CSSProperties, useMemo, useState } from "react";
import { downloadCsv } from "@/components/admin/csv-export";

type OrderOption = {
  id: string;
  customerEmail: string;
  customerName: string;
  companyName: string | null;
  carrierCode: "UPS" | "FEDEX";
  selectedService: string;
  trackingNumber: string | null;
  status: string;
  quotedCarrierAmount: number;
  actualCarrierAmount: number | null;
};

type AdjustmentRow = {
  id: string;
  orderId: string;
  customerId: string;
  carrierCode: "UPS" | "FEDEX";
  reason: string;
  originalQuotedAmount: number;
  carrierBilledAmount: number;
  amountToCharge: number;
  status: "PENDING" | "BILLED" | "PAID" | "FAILED" | "WAIVED";
  stripeInvoiceItemId: string | null;
  createdAt: string;
  order: {
    id: string;
    status: string;
    selectedCarrier: "UPS" | "FEDEX";
    selectedService: string;
    trackingNumber: string | null;
    labelUrl: string | null;
    quotedCarrierAmount: number;
    quotedCustomerAmount: number;
  };
  customer: {
    id: string;
    email: string;
    name: string;
    companyName: string | null;
    stripeCustomerId: string | null;
  };
};

type Props = {
  initialAdjustments: AdjustmentRow[];
  orderOptions: OrderOption[];
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

function normalizeAdjustment(row: AdjustmentRow) {
  return {
    ...row,
    originalQuotedAmount: Number(row.originalQuotedAmount),
    carrierBilledAmount: Number(row.carrierBilledAmount),
    amountToCharge: Number(row.amountToCharge),
    order: {
      ...row.order,
      quotedCarrierAmount: Number(row.order.quotedCarrierAmount),
      quotedCustomerAmount: Number(row.order.quotedCustomerAmount)
    }
  };
}

export function AdminAdjustmentsPanel({ initialAdjustments, orderOptions }: Props) {
  const [adjustments, setAdjustments] = useState(initialAdjustments.map(normalizeAdjustment));
  const [selectedOrderId, setSelectedOrderId] = useState(orderOptions[0]?.id ?? "");
  const [reason, setReason] = useState("Carrier rebilled higher dimensional weight");
  const [originalQuotedAmount, setOriginalQuotedAmount] = useState(orderOptions[0] ? String(orderOptions[0].actualCarrierAmount ?? orderOptions[0].quotedCarrierAmount) : "");
  const [carrierBilledAmount, setCarrierBilledAmount] = useState("");
  const [amountToCharge, setAmountToCharge] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [tableMessage, setTableMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const selectedOrder = orderOptions.find((order) => order.id === selectedOrderId) ?? null;
  const statuses = ["ALL", ...Array.from(new Set(adjustments.map((row) => row.status)))];

  const filteredAdjustments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return adjustments.filter((row) => {
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      const haystack = [
        row.id,
        row.orderId,
        row.customer.email,
        row.customer.companyName ?? "",
        row.reason,
        row.order.trackingNumber ?? "",
        row.order.selectedService
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [adjustments, query, statusFilter]);

  async function createAdjustment() {
    setFormMessage(null);

    if (!selectedOrderId) {
      setFormMessage("Choose an order first.");
      return;
    }

    if (!reason.trim()) {
      setFormMessage("Adjustment reason is required.");
      return;
    }

    setCreating(true);

    const response = await fetch("/api/admin/adjustments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId: selectedOrderId,
        reason,
        originalQuotedAmount,
        carrierBilledAmount,
        amountToCharge
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.adjustment) {
      setFormMessage(payload?.message ?? `Create failed with status ${response.status}.`);
      setCreating(false);
      return;
    }

    const created = normalizeAdjustment(payload.adjustment as AdjustmentRow);
    setAdjustments((current) => [created, ...current.filter((row) => row.id !== created.id)]);
    setCarrierBilledAmount("");
    setAmountToCharge("");
    setFormMessage(payload?.message ?? `Created adjustment ${created.id}.`);
    setCreating(false);
  }

  async function runAction(id: string, action: "bill" | "paid" | "waive") {
    setTableMessage(null);
    setActiveActionId(id);

    const response = await fetch(`/api/admin/adjustments/${id}/${action}`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.adjustment) {
      setTableMessage(payload?.message ?? `Action failed with status ${response.status}.`);
      setActiveActionId(null);
      return;
    }

    const updated = normalizeAdjustment(payload.adjustment as AdjustmentRow);
    setAdjustments((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setTableMessage(payload?.message ?? `Updated adjustment ${updated.id}.`);
    setActiveActionId(null);
  }

  function exportFilteredAdjustments() {
    downloadCsv("admin-adjustments.csv", [
      "adjustment_id",
      "created_at",
      "customer_email",
      "company_name",
      "order_id",
      "carrier",
      "service",
      "tracking_number",
      "reason",
      "original_quoted_amount",
      "carrier_billed_amount",
      "amount_to_charge",
      "status",
      "stripe_invoice_item_id"
    ], filteredAdjustments.map((row) => ([
      row.id,
      row.createdAt,
      row.customer.email,
      row.customer.companyName,
      row.order.id,
      row.order.selectedCarrier,
      row.order.selectedService,
      row.order.trackingNumber,
      row.reason,
      row.originalQuotedAmount,
      row.carrierBilledAmount,
      row.amountToCharge,
      row.status,
      row.stripeInvoiceItemId
    ])));
  }

  return (
    <section className="section" style={{ display: "grid", gap: "24px" }}>
      <div className="card">
        <p className="eyebrow">Create adjustment</p>
        <h2>Record a carrier rebill against an order</h2>
        <p className="muted">
          Pick a stored order, enter the final carrier bill, and the portal will keep the order flagged until the adjustment is billed, paid, or waived.
        </p>

        <div className="form-grid">
          <label className="field">
            <span>Order</span>
            <select
              value={selectedOrderId}
              onChange={(event) => {
                const nextOrderId = event.target.value;
                const nextOrder = orderOptions.find((order) => order.id === nextOrderId) ?? null;
                setSelectedOrderId(nextOrderId);
                setOriginalQuotedAmount(nextOrder ? String(nextOrder.actualCarrierAmount ?? nextOrder.quotedCarrierAmount) : "");
              }}
              style={inputStyle}
            >
              {orderOptions.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} - {(order.companyName || order.customerName || order.customerEmail)} - {order.carrierCode} {order.selectedService}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reason</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} style={inputStyle} />
          </label>
          <label className="field">
            <span>Original quoted carrier amount</span>
            <input type="number" step="0.01" value={originalQuotedAmount} onChange={(event) => setOriginalQuotedAmount(event.target.value)} style={inputStyle} />
          </label>
          <label className="field">
            <span>Carrier billed amount</span>
            <input type="number" step="0.01" value={carrierBilledAmount} onChange={(event) => setCarrierBilledAmount(event.target.value)} style={inputStyle} />
          </label>
          <label className="field">
            <span>Amount to charge customer</span>
            <input type="number" step="0.01" value={amountToCharge} onChange={(event) => setAmountToCharge(event.target.value)} placeholder="Leave blank to auto-calculate" style={inputStyle} />
          </label>
        </div>

        {selectedOrder ? (
          <p className="muted">
            Selected order status: {selectedOrder.status}. Tracking: {selectedOrder.trackingNumber ?? "Pending"}. Quoted carrier amount: {money(selectedOrder.quotedCarrierAmount)}.
          </p>
        ) : null}

        <div className="actions">
          <button className="button primary" type="button" onClick={createAdjustment} disabled={creating}>
            {creating ? "Creating..." : "Create adjustment"}
          </button>
        </div>

        {formMessage ? <p className="muted">{formMessage}</p> : null}
      </div>

      <div className="card">
        <p className="eyebrow">Adjustment queue</p>
        <h2>Bill, reconcile, or waive carrier rebills</h2>
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
              placeholder="Search by adjustment, order, customer, tracking, or reason"
              style={inputStyle}
            />
          </label>
        </div>

        <p className="muted" style={{ marginTop: "16px" }}>
          Showing {filteredAdjustments.length} of {adjustments.length} adjustments.
        </p>
        <div className="actions" style={{ marginTop: "16px" }}>
          <button className="button" type="button" onClick={exportFilteredAdjustments} disabled={filteredAdjustments.length === 0}>
            Export filtered CSV
          </button>
        </div>
        {tableMessage ? <p className="muted">{tableMessage}</p> : null}

        <div className="table" style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Customer</th>
                <th>Order</th>
                <th>Reason</th>
                <th>Quoted</th>
                <th>Billed</th>
                <th>Charge</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdjustments.map((row) => {
                const isBusy = activeActionId === row.id;
                const canBill = row.status === "PENDING" || row.status === "FAILED";
                const canResolve = row.status === "PENDING" || row.status === "BILLED" || row.status === "FAILED";

                return (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>
                      <div>{row.customer.companyName || row.customer.name}</div>
                      <div className="muted">{row.customer.email}</div>
                    </td>
                    <td>
                      <div>{row.order.id}</div>
                      <div className="muted">
                        {row.order.selectedCarrier} {row.order.selectedService}
                        {row.order.trackingNumber ? ` - ${row.order.trackingNumber}` : ""}
                      </div>
                    </td>
                    <td>
                      <div>{row.reason}</div>
                      {row.stripeInvoiceItemId ? <div className="muted">Invoice ref: {row.stripeInvoiceItemId}</div> : null}
                    </td>
                    <td>{money(row.originalQuotedAmount)}</td>
                    <td>{money(row.carrierBilledAmount)}</td>
                    <td>{money(row.amountToCharge)}</td>
                    <td>{row.status}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button className="button" type="button" onClick={() => runAction(row.id, "bill")} disabled={!canBill || isBusy}>
                          {isBusy && canBill ? "Working..." : "Bill"}
                        </button>
                        <button className="button" type="button" onClick={() => runAction(row.id, "paid")} disabled={!canResolve || isBusy}>
                          Mark paid
                        </button>
                        <button className="button" type="button" onClick={() => runAction(row.id, "waive")} disabled={!canResolve || isBusy}>
                          Waive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">No adjustments match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
