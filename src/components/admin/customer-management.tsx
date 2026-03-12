"use client";

import { CSSProperties, useState } from "react";

type WalletTransactionRow = {
  id: string;
  type: "TOP_UP" | "LABEL_PURCHASE" | "VOID_REFUND" | "MANUAL_CREDIT" | "MANUAL_DEBIT";
  status: "PENDING" | "COMPLETED" | "FAILED";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  order?: {
    id: string;
    selectedCarrier: "UPS" | "FEDEX";
    selectedService: string;
    status: string;
  } | null;
};

type CustomerRow = {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  walletBalance: number;
  walletTransactions: WalletTransactionRow[];
  pricingProfile: {
    markupPercent: number;
    flatFee: number;
    minimumProfit: number;
    residentialSurcharge: number;
    signatureSurcharge: number;
    enabled: boolean;
    allowUps: boolean;
    allowFedex: boolean;
    allowUpsPurchase: boolean;
    allowFedexPurchase: boolean;
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

type CreateCustomerForm = {
  name: string;
  companyName: string;
  email: string;
  password: string;
  markupPercent: string;
  flatFee: string;
  minimumProfit: string;
  residentialSurcharge: string;
  signatureSurcharge: string;
  enabled: boolean;
  allowUps: boolean;
  allowFedex: boolean;
  allowUpsPurchase: boolean;
  allowFedexPurchase: boolean;
};

type CustomerPayload = {
  id: string;
  email: string;
  name: string;
  companyName?: string | null;
  walletBalance?: number | string | null;
  walletTransactions?: WalletTransactionPayload[] | null;
  pricingProfile?: PricingProfilePayload | null;
  _count?: {
    orders?: number | string | null;
    quotes?: number | string | null;
  } | null;
  orders?: CustomerOrderPayload[] | null;
};

type WalletTransactionPayload = {
  id: string;
  type: WalletTransactionRow["type"];
  status: WalletTransactionRow["status"];
  amount: number | string;
  balanceAfter: number | string;
  description: string;
  createdAt: string | Date;
  order?: WalletTransactionRow["order"];
};

type PricingProfilePayload = {
  markupPercent: number | string;
  flatFee: number | string;
  minimumProfit: number | string;
  residentialSurcharge: number | string;
  signatureSurcharge: number | string;
  enabled: boolean;
  allowUps?: boolean;
  allowFedex?: boolean;
  allowUpsPurchase?: boolean;
  allowFedexPurchase?: boolean;
};

type CustomerOrderPayload = {
  id: string;
  createdAt: string | Date;
  status: string;
};

function asInput(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

function money(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

const adminButtonBaseStyle: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.85rem 1.35rem",
  fontSize: "1rem",
  fontWeight: 700,
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "all 160ms ease",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px"
};

const adminPrimaryButtonStyle: CSSProperties = {
  ...adminButtonBaseStyle,
  background: "#c85c2b",
  color: "#fffdf7",
  borderColor: "#c85c2b"
};

const adminDisabledPrimaryButtonStyle: CSSProperties = {
  ...adminButtonBaseStyle,
  background: "#e8ddca",
  color: "#fffaf0",
  borderColor: "#e8ddca",
  cursor: "not-allowed"
};

function normalizeCustomer(customer: CustomerPayload): CustomerRow {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    companyName: customer.companyName ?? null,
    walletBalance: Number(customer.walletBalance ?? 0),
    walletTransactions: Array.isArray(customer.walletTransactions)
      ? customer.walletTransactions.map((transaction: WalletTransactionPayload) => ({
          id: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amount: Number(transaction.amount),
          balanceAfter: Number(transaction.balanceAfter),
          description: transaction.description,
          createdAt: typeof transaction.createdAt === "string" ? transaction.createdAt : new Date(transaction.createdAt).toISOString(),
          order: transaction.order
            ? {
                id: transaction.order.id,
                selectedCarrier: transaction.order.selectedCarrier,
                selectedService: transaction.order.selectedService,
                status: transaction.order.status
              }
            : null
        }))
      : [],
    pricingProfile: customer.pricingProfile
      ? {
          markupPercent: Number(customer.pricingProfile.markupPercent),
          flatFee: Number(customer.pricingProfile.flatFee),
          minimumProfit: Number(customer.pricingProfile.minimumProfit),
          residentialSurcharge: Number(customer.pricingProfile.residentialSurcharge),
          signatureSurcharge: Number(customer.pricingProfile.signatureSurcharge),
          enabled: Boolean(customer.pricingProfile.enabled),
          allowUps: customer.pricingProfile.allowUps !== false,
          allowFedex: customer.pricingProfile.allowFedex !== false,
          allowUpsPurchase: customer.pricingProfile.allowUpsPurchase !== false,
          allowFedexPurchase: customer.pricingProfile.allowFedexPurchase !== false
        }
      : null,
    _count: {
      orders: Number(customer._count?.orders ?? 0),
      quotes: Number(customer._count?.quotes ?? 0)
    },
    orders: Array.isArray(customer.orders)
      ? customer.orders.map((order: CustomerOrderPayload) => ({
          id: order.id,
          createdAt: typeof order.createdAt === "string" ? order.createdAt : new Date(order.createdAt).toISOString(),
          status: order.status
        }))
      : []
  };
}

export function CustomerManagement({ customers }: Props) {
  const [rows, setRows] = useState(customers);
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [walletAdjusting, setWalletAdjusting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [walletAmountDraft, setWalletAmountDraft] = useState("25");
  const [walletNoteDraft, setWalletNoteDraft] = useState("");
  const [createForm, setCreateForm] = useState<CreateCustomerForm>({
    name: "",
    companyName: "",
    email: "",
    password: "",
    markupPercent: "12",
    flatFee: "1.5",
    minimumProfit: "4",
    residentialSurcharge: "1",
    signatureSurcharge: "2.5",
    enabled: true,
    allowUps: true,
    allowFedex: true,
    allowUpsPurchase: true,
    allowFedexPurchase: true
  });

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  function updateSelected(field: string, value: string | boolean) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== selectedId) {
          return row;
        }

        if (field === "name" || field === "companyName") {
          return {
            ...row,
            [field]: value
          };
        }

        const pricingProfile = row.pricingProfile ?? {
          markupPercent: 0,
          flatFee: 0,
          minimumProfit: 0,
          residentialSurcharge: 0,
          signatureSurcharge: 0,
          enabled: true,
          allowUps: true,
          allowFedex: true,
          allowUpsPurchase: true,
          allowFedexPurchase: true
        };

        return {
          ...row,
          pricingProfile: {
            ...pricingProfile,
            [field]: ["enabled", "allowUps", "allowFedex", "allowUpsPurchase", "allowFedexPurchase"].includes(field) ? Boolean(value) : Number(value)
          }
        };
      })
    );
  }

  function updateCreateForm(field: keyof CreateCustomerForm, value: string | boolean) {
    setCreateForm((current) => ({
      ...current,
      [field]: value
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
        enabled: selected.pricingProfile?.enabled ?? true,
        allowUps: selected.pricingProfile?.allowUps ?? true,
        allowFedex: selected.pricingProfile?.allowFedex ?? true,
        allowUpsPurchase: selected.pricingProfile?.allowUpsPurchase ?? true,
        allowFedexPurchase: selected.pricingProfile?.allowFedexPurchase ?? true
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.customer) {
      setMessage(payload?.message ?? `Update failed with status ${response.status}.`);
      setSaving(false);
      return;
    }

    const normalized = normalizeCustomer(payload.customer);
    setRows((current) => current.map((row) => (row.id === selected.id ? normalized : row)));
    setMessage(payload.message ?? "Customer updated.");
    setSaving(false);
  }

  async function createCustomer() {
    setCreateMessage(null);

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateMessage("Please complete name, email, and password.");
      return;
    }

    if (!createForm.email.includes("@")) {
      setCreateMessage("Please enter a valid email address.");
      return;
    }

    setCreating(true);

    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: createForm.name,
        companyName: createForm.companyName,
        email: createForm.email,
        password: createForm.password,
        markupPercent: Number(createForm.markupPercent),
        flatFee: Number(createForm.flatFee),
        minimumProfit: Number(createForm.minimumProfit),
        residentialSurcharge: Number(createForm.residentialSurcharge),
        signatureSurcharge: Number(createForm.signatureSurcharge),
        enabled: createForm.enabled,
        allowUps: createForm.allowUps,
        allowFedex: createForm.allowFedex,
        allowUpsPurchase: createForm.allowUpsPurchase,
        allowFedexPurchase: createForm.allowFedexPurchase
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.customer) {
      setCreateMessage(payload?.message ?? `Create failed with status ${response.status}.`);
      setCreating(false);
      return;
    }

    const normalized = normalizeCustomer(payload.customer);
    setRows((current) => [normalized, ...current]);
    setSelectedId(normalized.id);
    setPasswordDraft("");
    setPasswordMessage(null);
    setCreateForm({
      name: "",
      companyName: "",
      email: "",
      password: "",
      markupPercent: "12",
      flatFee: "1.5",
      minimumProfit: "4",
      residentialSurcharge: "1",
      signatureSurcharge: "2.5",
      enabled: true,
      allowUps: true,
      allowFedex: true,
      allowUpsPurchase: true,
      allowFedexPurchase: true
    });
    setCreateMessage(payload.message ?? "Customer created.");
    setCreating(false);
  }

  async function resetCustomerPassword() {
    if (!selected) {
      return;
    }

    setPasswordMessage(null);

    if (!passwordDraft.trim()) {
      setPasswordMessage("Please enter a new temporary password.");
      return;
    }

    if (passwordDraft.trim().length < 8) {
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }

    setResettingPassword(true);

    const response = await fetch(`/api/admin/customers/${selected.id}/password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: passwordDraft
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setPasswordMessage(payload?.message ?? `Password reset failed with status ${response.status}.`);
      setResettingPassword(false);
      return;
    }

    setPasswordDraft("");
    setPasswordMessage(payload?.message ?? `Reset password for ${selected.email}.`);
    setResettingPassword(false);
  }

  async function applyWalletAdjustment(sign: 1 | -1) {
    if (!selected) {
      return;
    }

    setWalletMessage(null);
    const amount = Number(walletAmountDraft);

    if (!Number.isFinite(amount) || amount <= 0) {
      setWalletMessage("Enter a wallet adjustment amount greater than zero.");
      return;
    }

    setWalletAdjusting(true);

    const response = await fetch(`/api/admin/customers/${selected.id}/wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Number((amount * sign).toFixed(2)),
        note: walletNoteDraft
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.wallet) {
      setWalletMessage(payload?.message ?? `Wallet adjustment failed with status ${response.status}.`);
      setWalletAdjusting(false);
      return;
    }

    setRows((current) => current.map((row) => {
      if (row.id !== selected.id) {
        return row;
      }

      return {
        ...row,
        walletBalance: Number(payload.wallet.balance ?? row.walletBalance),
        walletTransactions: Array.isArray(payload.wallet.transactions) ? payload.wallet.transactions : row.walletTransactions
      };
    }));
    setWalletNoteDraft("");
    setWalletMessage(payload.message ?? "Wallet updated.");
    setWalletAdjusting(false);
  }

  return (
    <section className="section" style={{ display: "grid", gap: "24px" }}>
      <div className="card">
        <p className="eyebrow">Create customer</p>
        <h2>Add a new customer account</h2>
        <p className="muted">Create a customer with a starting password and default pricing profile, then fine-tune their markup below.</p>

        <div className="form-grid">
          <label className="field">
            <span>Contact name</span>
            <input value={createForm.name} onChange={(event) => updateCreateForm("name", event.target.value)} />
          </label>
          <label className="field">
            <span>Company</span>
            <input value={createForm.companyName} onChange={(event) => updateCreateForm("companyName", event.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={createForm.email} onChange={(event) => updateCreateForm("email", event.target.value)} />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input type="password" value={createForm.password} onChange={(event) => updateCreateForm("password", event.target.value)} />
          </label>
          <label className="field">
            <span>Markup percent</span>
            <input type="number" step="0.001" value={createForm.markupPercent} onChange={(event) => updateCreateForm("markupPercent", event.target.value)} />
          </label>
          <label className="field">
            <span>Flat fee</span>
            <input type="number" step="0.01" value={createForm.flatFee} onChange={(event) => updateCreateForm("flatFee", event.target.value)} />
          </label>
          <label className="field">
            <span>Minimum profit</span>
            <input type="number" step="0.01" value={createForm.minimumProfit} onChange={(event) => updateCreateForm("minimumProfit", event.target.value)} />
          </label>
          <label className="field">
            <span>Residential surcharge</span>
            <input type="number" step="0.01" value={createForm.residentialSurcharge} onChange={(event) => updateCreateForm("residentialSurcharge", event.target.value)} />
          </label>
          <label className="field">
            <span>Signature surcharge</span>
            <input type="number" step="0.01" value={createForm.signatureSurcharge} onChange={(event) => updateCreateForm("signatureSurcharge", event.target.value)} />
          </label>
          <label className="field">
            <span>Profile enabled</span>
            <select value={createForm.enabled ? "enabled" : "disabled"} onChange={(event) => updateCreateForm("enabled", event.target.value === "enabled")}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field">
            <span>Allow UPS</span>
            <select value={createForm.allowUps ? "enabled" : "disabled"} onChange={(event) => updateCreateForm("allowUps", event.target.value === "enabled")}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field">
            <span>Allow FedEx</span>
            <select value={createForm.allowFedex ? "enabled" : "disabled"} onChange={(event) => updateCreateForm("allowFedex", event.target.value === "enabled")}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field">
            <span>Allow UPS purchase</span>
            <select value={createForm.allowUpsPurchase ? "enabled" : "disabled"} onChange={(event) => updateCreateForm("allowUpsPurchase", event.target.value === "enabled")}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="field">
            <span>Allow FedEx purchase</span>
            <select value={createForm.allowFedexPurchase ? "enabled" : "disabled"} onChange={(event) => updateCreateForm("allowFedexPurchase", event.target.value === "enabled")}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button className="button primary" style={creating ? adminDisabledPrimaryButtonStyle : adminPrimaryButtonStyle} type="button" onClick={createCustomer} disabled={creating}>
            {creating ? "Creating..." : "Create customer"}
          </button>
        </div>

        {createMessage ? <p className="muted">{createMessage}</p> : null}
      </div>

      <section className="grid-2">
        <div className="card">
          <p className="eyebrow">Customer management</p>
          <h2>Customer pricing profiles</h2>
          <p className="muted">Select a customer to adjust markup, fees, surcharges, carrier access, and wallet balance without touching the database directly.</p>
          <div className="table" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Markup</th>
                  <th>Wallet</th>
                  <th>Carriers</th>
                  <th>Orders</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const active = row.id === selectedId;
                  const carriers = row.pricingProfile
                    ? [row.pricingProfile.allowUps ? "UPS" : null, row.pricingProfile.allowFedex ? "FedEx" : null].filter(Boolean).join(" + ") || "None"
                    : "-";
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: "pointer", background: active ? "rgba(210, 163, 77, 0.12)" : undefined }}>
                      <td>
                        <strong>{row.companyName || row.name}</strong>
                        <div className="muted">{row.email}</div>
                      </td>
                      <td>{row.pricingProfile ? `${row.pricingProfile.markupPercent}%` : "-"}</td>
                      <td>{money(row.walletBalance)}</td>
                      <td>{carriers}</td>
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
                <label className="field">
                  <span>Allow UPS</span>
                  <select value={selected.pricingProfile?.allowUps === false ? "disabled" : "enabled"} onChange={(event) => updateSelected("allowUps", event.target.value === "enabled")}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Allow FedEx</span>
                  <select value={selected.pricingProfile?.allowFedex === false ? "disabled" : "enabled"} onChange={(event) => updateSelected("allowFedex", event.target.value === "enabled")}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Allow UPS purchase</span>
                  <select value={selected.pricingProfile?.allowUpsPurchase === false ? "disabled" : "enabled"} onChange={(event) => updateSelected("allowUpsPurchase", event.target.value === "enabled")}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="field">
                  <span>Allow FedEx purchase</span>
                  <select value={selected.pricingProfile?.allowFedexPurchase === false ? "disabled" : "enabled"} onChange={(event) => updateSelected("allowFedexPurchase", event.target.value === "enabled")}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
              </div>

              <div className="actions">
                <button className="button primary" style={saving ? adminDisabledPrimaryButtonStyle : adminPrimaryButtonStyle} type="button" onClick={saveSelected} disabled={saving}>
                  {saving ? "Saving..." : "Save customer profile"}
                </button>
              </div>

              {message ? <p className="muted">{message}</p> : null}

              <div className="card" style={{ marginTop: "16px", background: "rgba(255, 250, 240, 0.55)" }}>
                <p className="eyebrow">Wallet operations</p>
                <h3 style={{ marginTop: 0 }}>Adjust prepaid balance</h3>
                <p className="muted">Current wallet balance: {money(selected.walletBalance)}</p>
                <div className="form-grid">
                  <label className="field">
                    <span>Adjustment amount</span>
                    <input type="number" step="0.01" min="0.01" value={walletAmountDraft} onChange={(event) => setWalletAmountDraft(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Admin note</span>
                    <input value={walletNoteDraft} onChange={(event) => setWalletNoteDraft(event.target.value)} placeholder="Manual correction, goodwill credit, reconciliation, etc." />
                  </label>
                </div>
                <div className="actions">
                  <button className="button primary" style={walletAdjusting ? adminDisabledPrimaryButtonStyle : adminPrimaryButtonStyle} type="button" onClick={() => applyWalletAdjustment(1)} disabled={walletAdjusting}>
                    {walletAdjusting ? "Updating..." : "Credit wallet"}
                  </button>
                  <button className="button" type="button" onClick={() => applyWalletAdjustment(-1)} disabled={walletAdjusting}>
                    Debit wallet
                  </button>
                </div>
                {walletMessage ? <p className="muted">{walletMessage}</p> : null}

                <div className="table" style={{ marginTop: "16px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance after</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.walletTransactions.length ? selected.walletTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                          <td>{transaction.type}</td>
                          <td>{money(transaction.amount)}</td>
                          <td>{money(transaction.balanceAfter)}</td>
                          <td>
                            <div>{transaction.description}</div>
                            {transaction.order ? <div className="muted">Order {transaction.order.id} · {transaction.order.selectedCarrier} {transaction.order.selectedService}</div> : null}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5}>No wallet activity yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ marginTop: "16px", background: "rgba(255, 250, 240, 0.55)" }}>
                <p className="eyebrow">Reset password</p>
                <h3 style={{ marginTop: 0 }}>Set a new temporary password</h3>
                <p className="muted">Use this when a customer forgets their password or you want to rotate access manually.</p>
                <div className="form-grid">
                  <label className="field">
                    <span>New temporary password</span>
                    <input type="password" value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} />
                  </label>
                </div>
                <div className="actions">
                  <button className="button primary" style={resettingPassword ? adminDisabledPrimaryButtonStyle : adminPrimaryButtonStyle} type="button" onClick={resetCustomerPassword} disabled={resettingPassword}>
                    {resettingPassword ? "Resetting..." : "Reset customer password"}
                  </button>
                </div>
                {passwordMessage ? <p className="muted">{passwordMessage}</p> : null}
              </div>

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
                      <th>Wallet balance</th>
                      <td>{money(selected.walletBalance)}</td>
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
    </section>
  );
}

