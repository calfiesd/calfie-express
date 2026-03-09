"use client";

import { useState, useTransition } from "react";
import { PaymentCheckout } from "@/components/dashboard/payment-checkout";
import type { CarrierRate, CheckoutDraft, OrderDraft, PurchasedLabel, ShipmentInput, UpsQuoteResponse } from "@/lib/domain-types";

function money(value: number) {
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
  pricingSummary: {
    markupPercent: number;
    flatFee: number;
    minimumProfit: number;
  };
  customerEmail: string;
};

export function DashboardClient({
  initialShipment,
  initialQuote,
  stripeConfigured,
  stripePublishableKey,
  pricingSummary,
  customerEmail
}: DashboardClientProps) {
  const [shipment, setShipment] = useState(initialShipment);
  const [quote, setQuote] = useState(initialQuote);
  const [selectedRate, setSelectedRate] = useState<CarrierRate | null>(initialQuote.rates[0] ?? null);
  const [orderDraft, setOrderDraft] = useState<OrderDraft | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<{ note: string; purchased: PurchasedLabel | null; diagnostic?: string } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [isQuotePending, startQuoteTransition] = useTransition();
  const [isOrderPending, startOrderTransition] = useTransition();
  const [isCheckoutPending, startCheckoutTransition] = useTransition();

  function updateField<K extends keyof ShipmentInput>(key: K, value: ShipmentInput[K]) {
    setShipment((current) => ({ ...current, [key]: value }));
  }

  function updateAddress(section: "shipFrom" | "shipTo", key: keyof ShipmentInput["shipFrom"], value: string) {
    setShipment((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value
      }
    }));
  }

  function submitQuote() {
    setQuoteError(null);
    setOrderDraft(null);
    setCheckoutDraft(null);
    setPurchaseResult(null);
    startQuoteTransition(async () => {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ shipment })
      });

      if (!response.ok) {
        setQuoteError(`Quote request failed with status ${response.status}.`);
        return;
      }

      const nextQuote = (await response.json()) as UpsQuoteResponse;
      setQuote(nextQuote);
      setSelectedRate(nextQuote.rates[0] ?? null);
    });
  }

  function createOrderDraft() {
    if (!selectedRate) {
      setOrderMessage("Choose a UPS service first.");
      return;
    }

    setOrderMessage(null);
    setCheckoutDraft(null);
    setPurchaseResult(null);
    startOrderTransition(async () => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rate: selectedRate, shipment })
      });

      if (!response.ok) {
        setOrderMessage(`Order draft failed with status ${response.status}.`);
        return;
      }

      const payload = await response.json();
      setOrderDraft(payload.order as OrderDraft);
      setOrderMessage(payload.note as string);
    });
  }

  function createCheckoutDraft() {
    if (!orderDraft) {
      setCheckoutMessage("Create an order draft before starting checkout.");
      return;
    }

    setCheckoutMessage(null);
    setPurchaseResult(null);
    startCheckoutTransition(async () => {
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
    });
  }

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">Customer portal</p>
          <h1>CALFIE EXPRESS UPS shipping dashboard</h1>
          <p className="copy">
            This flow now submits the quote form to the live UPS quote endpoint, renders the returned services,
            creates an order draft, prepares a Stripe checkout draft, and can confirm payment before a real UPS label purchase attempt.
          </p>
        </div>
        <div className="card">
          <div className="muted">Pricing profile</div>
          <div className="kpi">{pricingSummary.markupPercent}%</div>
          <div className="muted">
            Flat fee {money(pricingSummary.flatFee)} - Minimum profit {money(pricingSummary.minimumProfit)}
          </div>
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
          <h2>UPS mode</h2>
          <p className="muted">Current source: {quote.source === "live" ? "Live UPS" : "Fallback pricing"}</p>
          <p className="muted">Quote endpoint: <code>/api/quotes</code></p>
        </div>
        <div className="card">
          <h2>UPS diagnostic</h2>
          <p className="muted">{quote.diagnostic}</p>
        </div>
      </section>

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
          </div>
          <div className="actions">
            <button className="button primary" type="button" onClick={submitQuote} disabled={isQuotePending}>{isQuotePending ? "Loading quotes..." : "Get live UPS quotes"}</button>
          </div>
          {quoteError ? <p className="muted">{quoteError}</p> : null}
        </div>

        <div className="card">
          <h2>Selected service</h2>
          {selectedRate ? (
            <>
              <p className="muted">{selectedRate.serviceName}</p>
              <p className="muted">Customer charge: {money(selectedRate.customerPrice)}</p>
              <p className="muted">Carrier cost: {money(selectedRate.carrierCost)}</p>
              <p className="muted">Margin: {money(selectedRate.customerPrice - selectedRate.carrierCost)}</p>
              <div className="actions">
                <button className="button primary" type="button" onClick={createOrderDraft} disabled={isOrderPending}>{isOrderPending ? "Creating draft..." : "Create order draft"}</button>
                <button className="button" type="button" onClick={createCheckoutDraft} disabled={isCheckoutPending || !orderDraft}>{isCheckoutPending ? "Preparing checkout..." : "Prepare checkout"}</button>
              </div>
            </>
          ) : <p className="muted">Get a quote to choose a UPS service.</p>}
          {orderDraft ? <div><p className="muted">Draft order: {orderDraft.id}</p><p className="muted">Status: {orderDraft.status}</p></div> : null}
          {orderMessage ? <p className="muted">{orderMessage}</p> : null}
          {checkoutDraft ? <div><p className="muted">Payment intent: {checkoutDraft.paymentIntentId}</p><p className="muted">Checkout mode: {checkoutDraft.paymentMode}</p><p className="muted">Amount: {money(checkoutDraft.amount)}</p><p className="muted">Status: {checkoutDraft.status}</p></div> : null}
          {checkoutMessage ? <p className="muted">{checkoutMessage}</p> : null}
        </div>
      </section>

      {checkoutDraft && orderDraft ? (
        <section className="section card">
          <h2>Checkout</h2>
          <p className="muted">Confirm payment for the selected UPS service. Successful payment will call the paid-order endpoint.</p>
          <PaymentCheckout publishableKey={stripePublishableKey} checkoutDraft={checkoutDraft} orderDraft={orderDraft} onCompleted={setPurchaseResult} />
          {purchaseResult ? <div><p className="muted">{purchaseResult.note}</p>{purchaseResult.purchased ? <p className="muted">Tracking: {purchaseResult.purchased.trackingNumber}</p> : null}{purchaseResult.purchased ? <p className="muted">Label URL ready: {purchaseResult.purchased.labelUrl ? "Yes" : "No"}</p> : null}{purchaseResult.diagnostic ? <p className="muted">Diagnostic: {purchaseResult.diagnostic}</p> : null}</div> : null}
        </section>
      ) : null}

      <section className="section table">
        <table>
          <thead><tr><th>Pick</th><th>Service</th><th>Transit</th><th>Carrier cost</th><th>Customer price</th><th>Margin</th></tr></thead>
          <tbody>
            {quote.rates.map((rate) => {
              const selected = selectedRate?.serviceCode === rate.serviceCode;
              return <tr key={`${rate.carrier}-${rate.serviceCode}`}><td><button className="button" type="button" onClick={() => setSelectedRate(rate)}>{selected ? "Selected" : "Choose"}</button></td><td>{rate.serviceName}</td><td>{rate.transitDays} day(s)</td><td>{money(rate.carrierCost)}</td><td>{money(rate.customerPrice)}</td><td>{money(rate.customerPrice - rate.carrierCost)}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}