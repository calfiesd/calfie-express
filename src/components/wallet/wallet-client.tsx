"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { PaymentMethodSummary, WalletSummary, WalletTopUpDraft } from "@/lib/domain-types";

function money(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

type WalletFundingFormProps = {
  draft: WalletTopUpDraft;
  amount: string;
  onFunded(wallet: WalletSummary, note: string): void;
  onMessage(message: string | null): void;
};

function WalletFundingForm({ draft, amount, onFunded, onMessage }: WalletFundingFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function finalizeTopUp() {
    const response = await fetch("/api/wallet/confirm-top-up", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paymentIntentId: draft.paymentIntentId,
        amount: Number(amount)
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.wallet) {
      onMessage(payload?.message ?? `Wallet confirmation failed with status ${response.status}.`);
      return;
    }

    onFunded(payload.wallet as WalletSummary, payload.note as string);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage(null);

    if (draft.paymentMode === "demo") {
      setSubmitting(true);
      await finalizeTopUp();
      setSubmitting(false);
      return;
    }

    if (!stripe || !elements) {
      onMessage("Stripe Elements is still loading.");
      return;
    }

    setSubmitting(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      onMessage(result.error.message ?? "Wallet payment confirmation failed.");
      setSubmitting(false);
      return;
    }

    await finalizeTopUp();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {draft.paymentMode === "live" ? <PaymentElement /> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "Funding wallet..." : draft.paymentMode === "live" ? `Pay ${money(Number(amount))}` : `Simulate ${money(Number(amount))} top-up`}
        </button>
      </div>
    </form>
  );
}

type WalletClientProps = {
  initialWallet: WalletSummary;
  stripePublishableKey: string;
  stripeConfigured: boolean;
  initialPaymentMethod: PaymentMethodSummary | null;
};

export function WalletClient({ initialWallet, stripePublishableKey, stripeConfigured, initialPaymentMethod }: WalletClientProps) {
  const [wallet, setWallet] = useState(initialWallet);
  const [amount, setAmount] = useState("25");
  const [draft, setDraft] = useState<WalletTopUpDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const stripePromise = useMemo(() => {
    if (!stripePublishableKey) {
      return null;
    }

    return loadStripe(stripePublishableKey);
  }, [stripePublishableKey]);

  async function createDraft() {
    setMessage(null);
    const normalizedAmount = Number(amount);

    if (!(normalizedAmount >= 1)) {
      setMessage("Please enter a top-up amount of at least $1.00.");
      return;
    }

    setCreatingDraft(true);
    const response = await fetch("/api/wallet/top-up-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: normalizedAmount })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.checkout) {
      setMessage(payload?.message ?? `Top-up setup failed with status ${response.status}.`);
      setCreatingDraft(false);
      return;
    }

    setDraft(payload.checkout as WalletTopUpDraft);
    setMessage(payload.note as string);
    setCreatingDraft(false);
  }

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">Prepaid balance</p>
          <h1>Fund once, spend on labels from wallet</h1>
          <p className="copy">
            Add prepaid credit to this customer account, then use wallet funds for label checkout without creating a new card payment intent for every shipment.
          </p>
        </div>
        <div className="card">
          <div className="muted">Available balance</div>
          <div className="kpi">{money(wallet.balance)}</div>
          <div className="muted">Wallet deductions will be applied before Stripe label checkout.</div>
        </div>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Add funds</h2>
          <p className="muted">
            Default card: {initialPaymentMethod?.last4 ? `${initialPaymentMethod.brand?.toUpperCase() ?? "CARD"} ending in ${initialPaymentMethod.last4}` : "Not saved yet"}.
            {" "}
            <Link href="/payments">Manage payment settings</Link>
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Top-up amount</span>
              <input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button className="button primary" type="button" onClick={createDraft} disabled={creatingDraft}>
              {creatingDraft ? "Preparing payment..." : "Prepare top-up"}
            </button>
            <button className="button" type="button" onClick={() => setAmount("25")}>$25</button>
            <button className="button" type="button" onClick={() => setAmount("50")}>$50</button>
            <button className="button" type="button" onClick={() => setAmount("100")}>$100</button>
          </div>
          {!stripeConfigured ? <p className="muted">Stripe is not configured, so wallet funding runs in demo mode.</p> : null}
          {message ? <p className="muted">{message}</p> : null}
        </div>

        <div className="card">
          <h2>Checkout</h2>
          {draft ? (
            draft.paymentMode === "demo" || stripePromise ? (
              draft.paymentMode === "demo" ? (
                <WalletFundingForm
                  draft={draft}
                  amount={amount}
                  onMessage={setMessage}
                  onFunded={(nextWallet, note) => {
                    setWallet(nextWallet);
                    setDraft(null);
                    setMessage(note);
                  }}
                />
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret: draft.clientSecret }}>
                  <WalletFundingForm
                    draft={draft}
                    amount={amount}
                    onMessage={setMessage}
                    onFunded={(nextWallet, note) => {
                      setWallet(nextWallet);
                      setDraft(null);
                      setMessage(note);
                    }}
                  />
                </Elements>
              )
            ) : (
              <p className="muted">Stripe publishable key is missing, so the live wallet checkout form cannot load.</p>
            )
          ) : (
            <p className="muted">Prepare a top-up to load the payment form.</p>
          )}
        </div>
      </section>

      <section className="section table">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance after</th>
              <th>Description</th>
              <th>Order</th>
            </tr>
          </thead>
          <tbody>
            {wallet.transactions.length ? wallet.transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                <td>{transaction.type}</td>
                <td>{money(transaction.amount)}</td>
                <td>{money(transaction.balanceAfter)}</td>
                <td>{transaction.description}</td>
                <td>{transaction.order ? transaction.order.id : "-"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No wallet activity yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
