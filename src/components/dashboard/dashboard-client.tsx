"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PaymentCheckout } from "@/components/dashboard/payment-checkout";
import type {
  AddressValidationResult,
  CarrierRate,
  CheckoutDraft,
  OrderDraft,
  PurchasedLabel,
  SavedAddressSummary,
  ShipmentInput,
  UpsDebugAccount,
  UpsQuoteResponse
} from "@/lib/domain-types";

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

const secondaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#ffffff",
  color: "#1d2430"
} as const;

const disabledPrimaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#d7c6b4",
  borderColor: "#d7c6b4",
  color: "#fff7ef",
  cursor: "not-allowed"
} as const;

const disabledSecondaryButtonStyle = {
  ...buttonBaseStyle,
  backgroundColor: "#efe6d8",
  borderColor: "rgba(29, 36, 48, 0.12)",
  color: "#8b8173",
  cursor: "not-allowed"
} as const;
const statusBannerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
  marginBottom: "22px"
} as const;

const statusPanelStyle = {
  padding: "18px 20px",
  borderRadius: "20px",
  border: "1px solid rgba(29, 36, 48, 0.12)",
  background: "rgba(255, 250, 242, 0.96)",
  boxShadow: "0 12px 32px rgba(57, 41, 19, 0.08)"
} as const;

const livePanelStyle = {
  ...statusPanelStyle,
  background: "linear-gradient(135deg, rgba(214, 241, 223, 0.95), rgba(255, 250, 242, 0.96))",
  border: "1px solid rgba(61, 126, 83, 0.24)"
} as const;

const cautionPanelStyle = {
  ...statusPanelStyle,
  background: "linear-gradient(135deg, rgba(244, 229, 205, 0.95), rgba(255, 250, 242, 0.96))",
  border: "1px solid rgba(189, 139, 52, 0.24)"
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

type DashboardClientProps = {
  initialShipment: ShipmentInput;
  initialQuote: UpsQuoteResponse;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  customerEmail: string;
  initialWalletBalance: number;
  initialSavedAddresses: SavedAddressSummary[];
  initialAdjustmentSummary: {
    totalCount: number;
    unresolvedCount: number;
    outstandingAmount: number;
    latest: {
      id: string;
      status: string;
      orderId: string;
      reason: string;
      createdAt: string;
    } | null;
  };
  fedexPurchaseStatus?: {
    enabled: boolean;
    environment: string;
    diagnostic: string;
  };
};

export function DashboardClient({
  initialShipment,
  initialQuote,
  stripeConfigured,
  stripePublishableKey,
  customerEmail,
  initialWalletBalance,
  initialSavedAddresses,
  initialAdjustmentSummary,
  fedexPurchaseStatus
}: DashboardClientProps) {
  const [shipment, setShipment] = useState(initialShipment);
  const [quote, setQuote] = useState(initialQuote);
  const [currentQuoteId, setCurrentQuoteId] = useState(initialQuote.quoteId ?? null);
  const [selectedRate, setSelectedRate] = useState<CarrierRate | null>(initialQuote.rates[0] ?? null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ note: string; purchased: PurchasedLabel | null; diagnostic?: string } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState(initialSavedAddresses);
  const [adjustmentSummary] = useState(initialAdjustmentSummary);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const [saveAddressLabel, setSaveAddressLabel] = useState("");
  const [addressValidation, setAddressValidation] = useState<AddressValidationResult | null>(null);
  const [isAddressValidationPending, setIsAddressValidationPending] = useState(false);
  const [isQuotePending, setIsQuotePending] = useState(false);
  const [isOrderPending, setIsOrderPending] = useState(false);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);
  const [isWalletPending, setIsWalletPending] = useState(false);

  function resetDraftState() {
    setOrderDraft(null);
    setCheckoutDraft(null);
    setPurchaseResult(null);
    setOrderMessage(null);
    setCheckoutMessage(null);
    setWalletMessage(null);
  }

  function chooseRate(rate: CarrierRate) {
    setSelectedRate(rate);
    resetDraftState();
  }

  useEffect(() => {
    if (quote.rates.length > 0) {
      setIsQuotePending(false);
    }
  }, [quote]);

  function updateField<K extends keyof ShipmentInput>(key: K, value: ShipmentInput[K]) {
    setShipment((current) => ({ ...current, [key]: value }));
  }

  function updateAddress(section: "shipFrom" | "shipTo", key: keyof ShipmentInput["shipFrom"], value: string) {
    setAddressValidation(null);
    setShipment((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value
      }
    }));
  }

  function applySavedAddress(addressId: string) {
    setSelectedSavedAddressId(addressId);
    const match = savedAddresses.find((address) => address.id === addressId);
    if (!match) {
      return;
    }

    setShipment((current) => ({
      ...current,
      shipTo: {
        ...current.shipTo,
        name: match.name,
        company: match.company ?? "",
        phone: match.phone ?? "",
        email: match.email ?? "",
        line1: match.line1,
        city: match.city,
        state: match.state,
        postalCode: match.postalCode,
        countryCode: match.countryCode
      }
    }));
    resetDraftState();
  }

  async function saveCurrentDestination() {
    const label = saveAddressLabel.trim() || `${shipment.shipTo.name || "Recipient"} ${shipment.shipTo.postalCode}`.trim();
    setWalletMessage(null);

    const response = await fetch("/api/addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        label,
        name: shipment.shipTo.name,
        company: shipment.shipTo.company,
        phone: shipment.shipTo.phone,
        email: shipment.shipTo.email,
        line1: shipment.shipTo.line1,
        city: shipment.shipTo.city,
        state: shipment.shipTo.state,
        postalCode: shipment.shipTo.postalCode,
        countryCode: shipment.shipTo.countryCode,
        isDefault: savedAddresses.length === 0
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.address) {
      setWalletMessage(payload?.message ?? `Saved address failed with status ${response.status}.`);
      return;
    }

    const saved = payload.address as SavedAddressSummary;
    setSavedAddresses((current) => {
      const withoutCurrent = current.filter((address) => address.id !== saved.id).map((address) => ({
        ...address,
        isDefault: saved.isDefault ? false : address.isDefault
      }));
      return [saved, ...withoutCurrent];
    });
    setSelectedSavedAddressId(saved.id);
    setSaveAddressLabel("");
    setWalletMessage(payload?.message ?? `Saved ${saved.label}.`);
  }

  async function submitQuote() {
    setQuoteError(null);
    setAddressValidation(null);
    resetDraftState();
    setIsQuotePending(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ shipment })
      });

      if (!response.ok) {
        const text = await response.text();
        setQuoteError(`Quote request failed with status ${response.status}${text ? `: ${text}` : "."}`);
        return;
      }

      const nextQuote = (await response.json()) as UpsQuoteResponse;
      setQuote(nextQuote);
      setCurrentQuoteId(nextQuote.quoteId ?? null);

      if (nextQuote.rates[0]) {
        chooseRate(nextQuote.rates[0]);
      } else {
        setSelectedRate(null);
        resetDraftState();
      }
    } finally {
      setIsQuotePending(false);
    }
  }

  async function validateRecipientAddress() {
    setWalletMessage(null);
    setAddressValidation(null);
    setIsAddressValidationPending(true);

    try {
      const response = await fetch("/api/address-validation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address: {
            name: shipment.shipTo.name,
            company: shipment.shipTo.company,
            line1: shipment.shipTo.line1,
            city: shipment.shipTo.city,
            state: shipment.shipTo.state,
            postalCode: shipment.shipTo.postalCode,
            countryCode: shipment.shipTo.countryCode
          }
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.validation) {
        setWalletMessage(payload?.message ?? `Address validation failed with status ${response.status}.`);
        return;
      }

      setAddressValidation(payload.validation as AddressValidationResult);
    } finally {
      setIsAddressValidationPending(false);
    }
  }

  function applyValidatedCandidate(index: number) {
    const candidate = addressValidation?.candidates[index];
    if (!candidate) {
      return;
    }

    setShipment((current) => ({
      ...current,
      shipTo: {
        ...current.shipTo,
        line1: candidate.line1,
        city: candidate.city,
        state: candidate.state,
        postalCode: candidate.postalCodeExtended
          ? `${candidate.postalCode}-${candidate.postalCodeExtended}`
          : candidate.postalCode,
        countryCode: candidate.countryCode
      }
    }));
    setAddressValidation((current) => current ? {
      ...current,
      status: "valid",
      candidateCount: current.candidates.length
    } : current);
    resetDraftState();
  }

  async function createOrderDraft() {
    if (!selectedRate) {
      setOrderMessage("Choose a carrier service first.");
      return;
    }

    setOrderMessage(null);
    setCheckoutDraft(null);
    setPurchaseResult(null);
    setWalletMessage(null);
    setIsOrderPending(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rate: selectedRate,
          shipment,
          ...(currentQuoteId ? { quoteId: currentQuoteId } : {})
        })
      });

      if (!response.ok) {
        setOrderMessage(`Order draft failed with status ${response.status}.`);
        return;
      }

      const payload = await response.json();
      setOrderDraft(payload.order as OrderDraft);
      setOrderMessage(payload.note as string);
    } finally {
      setIsOrderPending(false);
    }
  }

  async function createCheckoutDraft() {
    if (!orderDraft) {
      setCheckoutMessage("Create an order draft before starting checkout.");
      return;
    }

    setCheckoutMessage(null);
    setPurchaseResult(null);
    setIsCheckoutPending(true);

    try {
      const response = await fetch("/api/payments/payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ order: orderDraft })
      });

      if (!response.ok) {
        setCheckoutMessage(`Checkout setup failed with status ${response.status}.`);
        return;
      }

      const payload = await response.json();
      setCheckoutDraft(payload.checkout as CheckoutDraft);
      setCheckoutMessage(payload.note as string);
    } finally {
      setIsCheckoutPending(false);
    }
  }

  async function payWithWallet() {
    if (!orderDraft) {
      setWalletMessage("Create an order draft before using wallet funds.");
      return;
    }

    setWalletMessage(null);
    setCheckoutDraft(null);
    setPurchaseResult(null);
    setIsWalletPending(true);

    try {
      const response = await fetch("/api/wallet/pay-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId: orderDraft.id })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setWalletMessage(payload?.message ?? `Wallet payment failed with status ${response.status}.`);
        return;
      }

      setWalletBalance(Number(payload?.wallet?.balance ?? walletBalance));
      setPurchaseResult({
        note: payload?.note,
        purchased: payload?.purchased,
        diagnostic: payload?.diagnostic
      });
      setWalletMessage(payload?.walletPayment?.alreadyPaid ? payload?.note : `Wallet charged successfully. Remaining balance ${money(payload?.wallet?.balance)}.`);
    } finally {
      setIsWalletPending(false);
    }
  }

  const walletCanCoverSelectedRate = walletBalance >= (selectedRate?.customerPrice ?? Number.POSITIVE_INFINITY);

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">Customer portal</p>
          <h1>CALFIE EXPRESS shipping dashboard</h1>
          <p className="copy">
            This flow now uses your primary UPS account for live UPS quotes and label purchase, while also showing FedEx comparison
            pricing so customers can choose between carriers from one screen.
          </p>
        </div>
        <div className="card">
          <div className="muted">Account pricing</div>
          <div className="kpi">Active</div>
          <div className="muted">
            Your customer-specific pricing rules are applied automatically to every quote you request.
          </div>
        </div>
      </section>

      <section className="section" style={statusBannerStyle}>
        <div style={livePanelStyle}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>UPS status</p>
          <h2 style={{ marginBottom: "8px" }}>Live purchase enabled</h2>
          <p className="muted" style={{ margin: 0 }}>
            UPS quotes are live on your primary account and the UPS purchase path is available when you are ready to use it.
          </p>
        </div>
        <div style={cautionPanelStyle}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>FedEx status</p>
          <h2 style={{ marginBottom: "8px" }}>Purchase guarded by safety switch</h2>
          <p className="muted" style={{ margin: 0 }}>
            FedEx quotes are currently {quote.fedexStatus?.mode ?? "unknown"}. Purchase status: {fedexPurchaseStatus?.diagnostic ?? "unknown"}.
          </p>
        </div>
      </section>

      <section className="section grid-4">
        <div className="card">
          <h2>Auth state</h2>
          <p className="muted">Email/password login endpoint: <code>/api/auth/login</code></p>
          <p className="muted">Signed in as: {customerEmail}</p>
        </div>
        <div className="card">
          <h2>Stripe state</h2>
          <p className="muted">Secret key configured: {stripeConfigured ? "Yes" : "No"}</p>
          <p className="muted">Setup intent endpoint: <code>/api/payments/setup-intent</code></p>
        </div>
        <div className="card">
          <h2>Wallet state</h2>
          <p className="muted">Available prepaid balance: {money(walletBalance)}</p>
          <p className="muted">Funding page: <Link href="/wallet">/wallet</Link></p>
        </div>
        <div className="card">
          <h2>Carrier mode</h2>
          <p className="muted">UPS quote mode: {quote.source === "live" ? "Live" : "Fallback"}</p>
          <p className="muted">FedEx quote mode: {quote.fedexStatus?.mode ?? "unknown"}</p>
          <p className="muted">Quote endpoint: <code>/api/quotes</code></p>
          <p className="muted">Simple Rate requested: {shipment.simpleRate ? "Yes" : "No"}</p>
        </div>
      </section>

      {adjustmentSummary.unresolvedCount > 0 ? (
        <section className="section card" style={{ borderColor: "rgba(189, 139, 52, 0.35)", background: "rgba(255, 248, 235, 0.96)" }}>
          <p className="eyebrow">Adjustment notice</p>
          <h2>Post-shipment carrier charges need review</h2>
          <p className="muted">
            You currently have {adjustmentSummary.unresolvedCount} open adjustment{adjustmentSummary.unresolvedCount === 1 ? "" : "s"} totaling {money(adjustmentSummary.outstandingAmount)}.
          </p>
          <p className="muted">
            Latest item: {adjustmentSummary.latest?.reason ?? "Unknown reason"} for order {adjustmentSummary.latest?.orderId ?? "Unknown"}.
          </p>
          <div className="actions">
            <Link className="button" href="/adjustments">Open adjustments</Link>
          </div>
        </section>
      ) : null}

      <section className="section grid-2">
        <div className="card">
          <h2>Shipment details</h2>
          <div className="form-grid">
            <label className="field"><span>From name</span><input value={shipment.shipFrom.name} onChange={(e) => updateAddress("shipFrom", "name", e.target.value)} /></label>
            <label className="field"><span>From phone</span><input value={shipment.shipFrom.phone} onChange={(e) => updateAddress("shipFrom", "phone", e.target.value)} /></label>
            <label className="field"><span>From line 1</span><input value={shipment.shipFrom.line1} onChange={(e) => updateAddress("shipFrom", "line1", e.target.value)} /></label>
            <label className="field"><span>From city</span><input value={shipment.shipFrom.city} onChange={(e) => updateAddress("shipFrom", "city", e.target.value)} /></label>
            <label className="field"><span>From state</span><input value={shipment.shipFrom.state} onChange={(e) => updateAddress("shipFrom", "state", e.target.value)} /></label>
            <label className="field"><span>From ZIP</span><input value={shipment.shipFrom.postalCode} onChange={(e) => updateAddress("shipFrom", "postalCode", e.target.value)} /></label>
            <label className="field">
              <span>Saved recipient</span>
              <select value={selectedSavedAddressId} onChange={(e) => applySavedAddress(e.target.value)}>
                <option value="">Select saved address</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label} - {address.city}, {address.state}
                  </option>
                ))}
              </select>
            </label>
            <label className="field"><span>Save destination as</span><input value={saveAddressLabel} onChange={(e) => setSaveAddressLabel(e.target.value)} placeholder="Warehouse, Amazon returns, Storefront" /></label>
            <label className="field"><span>To name</span><input value={shipment.shipTo.name} onChange={(e) => updateAddress("shipTo", "name", e.target.value)} /></label>
            <label className="field"><span>To phone</span><input value={shipment.shipTo.phone} onChange={(e) => updateAddress("shipTo", "phone", e.target.value)} /></label>
            <label className="field"><span>To line 1</span><input value={shipment.shipTo.line1} onChange={(e) => updateAddress("shipTo", "line1", e.target.value)} /></label>
            <label className="field"><span>To city</span><input value={shipment.shipTo.city} onChange={(e) => updateAddress("shipTo", "city", e.target.value)} /></label>
            <label className="field"><span>To state</span><input value={shipment.shipTo.state} onChange={(e) => updateAddress("shipTo", "state", e.target.value)} /></label>
            <label className="field"><span>To ZIP</span><input value={shipment.shipTo.postalCode} onChange={(e) => updateAddress("shipTo", "postalCode", e.target.value)} /></label>
            <label className="field"><span>Length</span><input type="number" value={shipment.packageLength} onChange={(e) => updateField("packageLength", Number(e.target.value))} /></label>
            <label className="field"><span>Width</span><input type="number" value={shipment.packageWidth} onChange={(e) => updateField("packageWidth", Number(e.target.value))} /></label>
            <label className="field"><span>Height</span><input type="number" value={shipment.packageHeight} onChange={(e) => updateField("packageHeight", Number(e.target.value))} /></label>
            <label className="field"><span>Weight</span><input type="number" value={shipment.packageWeight} onChange={(e) => updateField("packageWeight", Number(e.target.value))} /></label>
            <label className="field"><span>Declared value</span><input type="number" value={shipment.declaredValue} onChange={(e) => updateField("declaredValue", Number(e.target.value))} /></label>
            <label className="field"><span>Residential</span><select value={shipment.residential ? "yes" : "no"} onChange={(e) => updateField("residential", e.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
            <label className="field"><span>Simple Rate</span><select value={shipment.simpleRate ? "yes" : "no"} onChange={(e) => updateField("simpleRate", e.target.value === "yes")}><option value="yes">Yes</option><option value="no">No</option></select></label>
          </div>
          <div className="actions">
            <button className="button" type="button" onClick={validateRecipientAddress} disabled={isAddressValidationPending}>
              {isAddressValidationPending ? "Validating address..." : "Validate recipient"}
            </button>
            <button className="button" type="button" onClick={saveCurrentDestination}>Save destination</button>
            <Link className="button" href="/addresses">Open address book</Link>
            <button className="button primary" style={isQuotePending ? disabledPrimaryButtonStyle : primaryButtonStyle} type="button" onClick={submitQuote} disabled={isQuotePending}>{isQuotePending ? "Loading quotes..." : "Get carrier quotes"}</button>
          </div>
          {quoteError ? <p className="muted">{quoteError}</p> : null}
          {addressValidation ? (
            <div className="card" style={{ marginTop: "16px", background: "rgba(255, 250, 240, 0.55)" }}>
              <p className="eyebrow">Address validation</p>
              <h3 style={{ marginTop: 0 }}>
                {addressValidation.status === "valid"
                  ? "Recipient address validated"
                  : addressValidation.status === "ambiguous"
                    ? "Suggested address matches found"
                    : addressValidation.status === "invalid"
                      ? "Address not recognized"
                      : "Validation needs review"}
              </h3>
              {addressValidation.classification ? <p className="muted">Classification: {addressValidation.classification}</p> : null}
              {addressValidation.alerts.map((alert) => (
                <p key={alert} className="muted">{alert}</p>
              ))}
              {addressValidation.candidates.length ? (
                <div className="table" style={{ marginTop: "16px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Suggested address</th>
                        <th>Classification</th>
                        <th>Apply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addressValidation.candidates.map((candidate, index) => (
                        <tr key={`${candidate.line1}-${candidate.postalCode}-${index}`}>
                          <td>
                            <div>{candidate.line1}</div>
                            {candidate.line2 ? <div>{candidate.line2}</div> : null}
                            <div className="muted">
                              {candidate.city}, {candidate.state} {candidate.postalCodeExtended ? `${candidate.postalCode}-${candidate.postalCodeExtended}` : candidate.postalCode}
                            </div>
                          </td>
                          <td>{candidate.classification ?? "-"}</td>
                          <td>
                            <button className="button" type="button" onClick={() => applyValidatedCandidate(index)}>
                              Use suggestion
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Selected service</h2>
          {selectedRate ? (
            <>
              <p className="muted">Carrier: {selectedRate.carrier}</p>
              <p className="muted">{selectedRate.serviceName}</p>
              <p className="muted">Billing account: {selectedRate.accountLabel ?? selectedRate.accountNumber ?? "Unknown"}</p>
              <p className="muted">Customer charge: {money(selectedRate.customerPrice)}</p>
              <p className="muted">Carrier cost: {money(selectedRate.carrierCost)}</p>
              <p className="muted">Margin: {money(selectedRate.customerPrice - selectedRate.carrierCost)}</p>
              <p className="muted">Wallet available: {money(walletBalance)}</p>
              {selectedRate.carrier === "UPS" ? <p className="muted">Simple Rate: {shipment.simpleRate ? "Requested" : "Off"}</p> : null}
              {selectedRate.carrier === "FEDEX" ? <p className="muted">FedEx purchase environment: {fedexPurchaseStatus?.environment ?? "unknown"}. {fedexPurchaseStatus?.diagnostic ?? "FedEx purchase status unavailable."}</p> : null}
              <div className="actions">
                <button className="button primary" style={!selectedRate || isOrderPending ? disabledPrimaryButtonStyle : primaryButtonStyle} type="button" onClick={createOrderDraft} disabled={!selectedRate || isOrderPending}>{isOrderPending ? "Creating draft..." : "Create order draft"}</button>
                <button className="button" style={isCheckoutPending || !orderDraft ? disabledSecondaryButtonStyle : secondaryButtonStyle} type="button" onClick={createCheckoutDraft} disabled={isCheckoutPending || !orderDraft}>{isCheckoutPending ? "Preparing checkout..." : "Prepare Stripe checkout"}</button>
                <button className="button" style={isWalletPending || !orderDraft || !walletCanCoverSelectedRate ? disabledSecondaryButtonStyle : secondaryButtonStyle} type="button" onClick={payWithWallet} disabled={isWalletPending || !orderDraft || !walletCanCoverSelectedRate}>{isWalletPending ? "Charging wallet..." : "Pay with wallet"}</button>
              </div>
              {!walletCanCoverSelectedRate ? <p className="muted">Wallet balance is below this label cost. Add funds at <Link href="/wallet">/wallet</Link> or continue with Stripe checkout.</p> : null}
            </>
          ) : <p className="muted">Get a quote to choose a carrier service.</p>}
          {orderDraft ? <div><p className="muted">Draft order: {orderDraft.id}</p><p className="muted">Status: {orderDraft.status}</p></div> : null}
          {orderMessage ? <p className="muted">{orderMessage}</p> : null}
          {checkoutDraft ? <div><p className="muted">Payment intent: {checkoutDraft.paymentIntentId}</p><p className="muted">Checkout mode: {checkoutDraft.paymentMode}</p><p className="muted">Amount: {money(checkoutDraft.amount)}</p><p className="muted">Status: {checkoutDraft.status}</p></div> : null}
          {checkoutMessage ? <p className="muted">{checkoutMessage}</p> : null}
          {walletMessage ? <p className="muted">{walletMessage}</p> : null}
        </div>
      </section>

      {quote.debugAccounts?.length ? (
        <section className="section card">
          <h2>UPS raw debug</h2>
          <div className="table" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Selected</th>
                  <th>Published</th>
                  <th>Negotiated</th>
                  <th>Freight Net</th>
                </tr>
              </thead>
              <tbody>
                {quote.debugAccounts.flatMap((account: UpsDebugAccount, accountIndex) => {
                  if (account.status === "failure") {
                    return [
                      <tr key={`${account.accountNumber}-${accountIndex}-failure`}>
                        <td>{account.accountNumber}</td>
                        <td>failure</td>
                        <td colSpan={5}>{account.message ?? "Unknown UPS error"}</td>
                      </tr>
                    ];
                  }

                  return account.rates.map((rate) => (
                    <tr key={`${account.accountNumber}-${rate.serviceCode}`}>
                      <td>{account.accountNumber}</td>
                      <td>{rate.chargeSource}</td>
                      <td>{rate.serviceName}</td>
                      <td>{money(rate.selectedCharge)}</td>
                      <td>{money(rate.totalCharges)}</td>
                      <td>{money(rate.negotiatedCharges)}</td>
                      <td>{money(rate.freightNetCharge)}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {checkoutDraft && orderDraft ? (
        <section className="section card">
          <h2>Checkout</h2>
          <p className="muted">Confirm payment for the selected carrier service. Successful payment will call the paid-order endpoint.</p>
          <PaymentCheckout publishableKey={stripePublishableKey} checkoutDraft={checkoutDraft} orderDraft={orderDraft} onCompleted={setPurchaseResult} />
          {purchaseResult ? <div><p className="muted">{purchaseResult.note}</p>{purchaseResult.purchased ? <p className="muted">Tracking: {purchaseResult.purchased.trackingNumber}</p> : null}{purchaseResult.purchased ? <p className="muted">Label URL ready: {purchaseResult.purchased.labelUrl ? "Yes" : "No"}</p> : null}{purchaseResult.diagnostic ? <p className="muted">Diagnostic: {purchaseResult.diagnostic}</p> : null}</div> : null}
        </section>
      ) : null}

      {!checkoutDraft && purchaseResult ? (
        <section className="section card">
          <h2>Purchase result</h2>
          <p className="muted">{purchaseResult.note}</p>
          {purchaseResult.purchased ? <p className="muted">Tracking: {purchaseResult.purchased.trackingNumber}</p> : null}
          {purchaseResult.purchased ? <p className="muted">Label URL ready: {purchaseResult.purchased.labelUrl ? "Yes" : "No"}</p> : null}
          {purchaseResult.diagnostic ? <p className="muted">Diagnostic: {purchaseResult.diagnostic}</p> : null}
        </section>
      ) : null}

      <section className="section table">
        <table>
          <thead><tr><th>Pick</th><th>Carrier</th><th>Service</th><th>Billing account</th><th>Transit</th><th>Carrier cost</th><th>Customer price</th><th>Margin</th></tr></thead>
          <tbody>
            {quote.rates.map((rate) => {
              const selected = selectedRate?.carrier === rate.carrier && selectedRate?.serviceCode === rate.serviceCode;
              return <tr key={`${rate.carrier}-${rate.serviceCode}`}><td><button className="button" type="button" onClick={() => chooseRate(rate)}>{selected ? "Selected" : "Choose"}</button></td><td>{rate.carrier}</td><td>{rate.serviceName}</td><td>{rate.accountLabel ?? rate.accountNumber ?? "-"}</td><td>{rate.transitDays} day(s)</td><td>{money(rate.carrierCost)}</td><td>{money(rate.customerPrice)}</td><td>{money(rate.customerPrice - rate.carrierCost)}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
