"use client";

import { useState } from "react";

type CustomerRow = {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  pricingProfile: {
    markupPercent: number;
    flatFee: number;
    minimumProfit: number;
    residentialSurcharge: number;
    signatureSurcharge: number;
    enabled: boolean;
  } | null;
  _count: {
    orders: number;
    quotes: number;
  };
  orders: Array<{
    id: string;
    createdAt: string;
    status: string;
  }>;
};

type Props = {
  customers: CustomerRow[];
};

function asInput(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

export function CustomerManagement({ customers }: Props) {
  const [rows, setRows] = useState(customers);
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  function updateSelected(field: string, value: string | boolean) {
    setRows((current) => current.map((row) => {
      if (row.id !== selectedId) {
        return row;
      }

      if (field === "name" || field === "companyName") {
        return {
          ...row,
          [field]: value
        };
      }

      if (!row.pricingProfile) {
        return row;
      }

      return {
        ...row,
        pricingProfile: {
          ...row.pricingProfile,
          [field]: field === "enabled" ? Boolean(value) : Number(value)
        }
      };
    }));
  }

  async function saveSelected() {
    if (!selected) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/admin/customers/${selected.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: selected.name,
        companyName: selected.companyName ?? "",
        markupPercent: selected.pricingProfile?.markupPercent ?? 12,
        flatFee: selected.pricingProfile?.flatFee ?? 0,
        minimumProfit: selected.pricingProfile?.minimumProfit ?? 0,
        residentialSurcharge: selected.pricingProfile?.residentialSurcharge ?? 0,
        signatureSurcharge: selected.pricingProfile?.signatureSurcharge ?? 0,
        enabled: selected.pricingProfile?.enabled ?? true
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.customer) {
      setMessage(payload?.message ?? `Update failed with status ${response.status}.`);
      setSaving(false);
      return;
    }

    setRows((current) => current.map((row) => row.id === selected.id ? payload.customer : row));
    setMessage(payload.message ?? "Customer updated.");
    setSaving(false);
  }

  return (
    <section className="section grid-2">
      <div className="card">
        <p className="eyebrow">Customer management</p>
        <h2>Customer pricing profiles</h2>
        <p className="muted">Select a customer to adjust markup, fees, and surcharges without touching the database directly.</p>
        <div className="table" style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Markup</th>
                <th>Orders</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = row.id === selectedId;
                return (
                  <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: "pointer", background: active ? "rgba(210, 163, 77, 0.12)" : undefined }}>
                    <td>
                      <strong>{row.companyName || row.name}</strong>
                      <div className="muted">{row.email}</div>
                    </td>
                    <td>{row.pricingProfile ? `${row.pricingProfile.markupPercent}%` : "-"}</td>
                    <td>{row._count.orders}</td>
                    <td>{row.pricingProfile?.enabled === false ? "Disabled" : "Active"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Selected customer</p>
        <h2>{selected ? selected.email : "No customers yet"}</h2>
        {selected ? (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Contact name</span>
                <input value={selected.name} onChange={(event) => updateSelected("name", event.target.value)} />
              </label>
              <label className="field">
                <span>Company</span>
                <input value={selected.companyName ?? ""} onChange={(event) => updateSelected("companyName", event.target.value)} />
              </label>
              <label className="field">
                <span>Markup percent</span>
                <input type="number" step="0.001" value={asInput(selected.pricingProfile?.markupPercent)} onChange={(event) => updateSelected("markupPercent", event.target.value)} />
              </label>
              <label className="field">
                <span>Flat fee</span>
                <input type="number" step="0.01" value={asInput(selected.pricingProfile?.flatFee)} onChange={(event) => updateSelected("flatFee", event.target.value)} />
              </label>
              <label className="field">
                <span>Minimum profit</span>
                <input type="number" step="0.01" value={asInput(selected.pricingProfile?.minimumProfit)} onChange={(event) => updateSelected("minimumProfit", event.target.value)} />
              </label>
              <label className="field">
                <span>Residential surcharge</span>
                <input type="number" step="0.01" value={asInput(selected.pricingProfile?.residentialSurcharge)} onChange={(event) => updateSelected("residentialSurcharge", event.target.value)} />
              </label>
              <label className="field">
                <span>Signature surcharge</span>
                <input type="number" step="0.01" value={asInput(selected.pricingProfile?.signatureSurcharge)} onChange={(event) => updateSelected("signatureSurcharge", event.target.value)} />
              </label>
              <label className="field">
                <span>Profile enabled</span>
                <select value={selected.pricingProfile?.enabled === false ? "disabled" : "enabled"} onChange={(event) => updateSelected("enabled", event.target.value === "enabled")}>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>

            <div className="actions">
              <button className="button primary" type="button" onClick={saveSelected} disabled={saving}>
                {saving ? "Saving..." : "Save customer profile"}
              </button>
            </div>

            {message ? <p className="muted">{message}</p> : null}

            <div className="table" style={{ marginTop: "16px" }}>
              <table>
                <tbody>
                  <tr>
                    <th>Quotes</th>
                    <td>{selected._count.quotes}</td>
                  </tr>
                  <tr>
                    <th>Orders</th>
                    <td>{selected._count.orders}</td>
                  </tr>
                  <tr>
                    <th>Latest order</th>
                    <td>{selected.orders[0] ? `${selected.orders[0].status} (${new Date(selected.orders[0].createdAt).toLocaleDateString()})` : "No orders yet"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">No customer accounts exist yet.</p>
        )}
      </div>
    </section>
  );
}
