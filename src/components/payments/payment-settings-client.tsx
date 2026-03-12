"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { PaymentMethodSummary } from "@/lib/domain-types";

type SetupDraft = {
  mode: "live" | "demo";
  clientSecret: string;
  customerId: string;
  setupIntentId?: string;
};

type InnerProps = {
  draft: SetupDraft;
  onSaved(summary: PaymentMethodSummary, note: string): void;
  onMessage(message: string | null): void;
};

function describePaymentMethod(summary: PaymentMethodSummary | null) {
  if (!summary?.paymentMethodId) {
    return "No default card on file.";
  }

  if (summary.brand && summary.last4) {
    return `${summary.brand.toUpperCase()} ending in ${summary.last4}`;
  }

  return summary.paymentMethodId;
}

function InnerSetupForm({ draft, onSaved, onMessage }: InnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function finalizeSetup(setupIntentId: string) {
    const response = await fetch("/api/payments/confirm-setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ setupIntentId })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.paymentMethod) {
      onMessage(payload?.message ?? `Payment method save failed with status ${response.status}.`);
      return;
    }

    onSaved(payload.paymentMethod as PaymentMethodSummary, payload.note as string);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onMessage(null);
    setSubmitting(true);

    if (draft.mode === "demo") {
      await finalizeSetup(draft.setupIntentId ?? "seti_demo_saved_card");
      setSubmitting(false);
      return;
    }

    if (!stripe || !elements) {
      onMessage("Stripe Elements is still loading.");
      setSubmitting(false);
      return;
    }

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      onMessage(result.error.message ?? "Payment method confirmation failed.");
      setSubmitting(false);
      return;
    }

    const setupIntentId = result.setupIntent?.id ?? draft.setupIntentId;
    if (!setupIntentId) {
      onMessage("Stripe did not return a setup intent ID.");
      setSubmitting(false);
      return;
    }

    await finalizeSetup(setupIntentId);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {draft.mode === "live" ? <PaymentElement /> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "Saving payment method..." : draft.mode === "live" ? "Save default card" : "Simulate saved card"}
        </button>
      </div>
    </form>
  );
}

type Props = {
  stripeConfigured: boolean;
  stripePublishableKey: string;
  initialPaymentMethod: PaymentMethodSummary | null;
};

export function PaymentSettingsClient({
  stripeConfigured,
  stripePublishableKey,
  initialPaymentMethod
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const stripePromise = useMemo(() => {
    if (!stripePublishableKey) {
      return null;
    }

    return loadStripe(stripePublishableKey);
  }, [stripePublishableKey]);

  async function prepareSetup() {
    setMessage(null);
    setPreparing(true);

    const response = await fetch("/api/payments/setup-intent", {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.setupIntent) {
      setMessage(payload?.message ?? `Payment setup failed with status ${response.status}.`);
      setPreparing(false);
      return;
    }

    setDraft(payload.setupIntent as SetupDraft);
    setMessage("Payment method setup is ready. Confirm below to save your default card.");
    setPreparing(false);
  }

  return (
    <>
      <section className="section hero">
        <div>
          <p className="eyebrow">Payment settings</p>
          <h1>Saved card for wallet and rebill charges</h1>
          <p className="copy">
            Keep a default card on file so wallet top-ups and approved post-shipment carrier adjustments have a clear payment method behind them.
          </p>
        </div>
        <div className="card">
          <div className="muted">Default payment method</div>
          <div className="kpi" style={{ fontSize: "1.6rem" }}>{paymentMethod?.last4 ? `•••• ${paymentMethod.last4}` : "Not set"}</div>
          <div className="muted">{describePaymentMethod(paymentMethod)}</div>
        </div>
      </section>

      <section className="section grid-2">
        <div className="card">
          <h2>Saved card status</h2>
          <p className="muted">
            {paymentMethod?.paymentMethodId
              ? `Current default card: ${describePaymentMethod(paymentMethod)}.`
              : "No default card has been saved yet."}
          </p>
          {paymentMethod?.expMonth && paymentMethod?.expYear ? (
            <p className="muted">Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}</p>
          ) : null}
          <p className="muted">
            Customer support and admin tools may rely on this saved card for approved adjustment recovery after carrier rebills.
          </p>
          <div className="actions">
            <button className="button primary" type="button" onClick={prepareSetup} disabled={preparing}>
              {preparing ? "Preparing..." : paymentMethod?.paymentMethodId ? "Replace default card" : "Add default card"}
            </button>
            <Link className="button" href="/wallet">Open wallet</Link>
          </div>
          {!stripeConfigured ? <p className="muted">Stripe is not configured, so this page will run in demo mode.</p> : null}
          {message ? <p className="muted">{message}</p> : null}
        </div>

        <div className="card">
          <h2>Save payment method</h2>
          {draft ? (
            draft.mode === "demo" || stripePromise ? (
              draft.mode === "demo" ? (
                <InnerSetupForm
                  draft={draft}
                  onMessage={setMessage}
                  onSaved={(summary, note) => {
                    setPaymentMethod(summary);
                    setDraft(null);
                    setMessage(note);
                  }}
                />
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret: draft.clientSecret }}>
                  <InnerSetupForm
                    draft={draft}
                    onMessage={setMessage}
                    onSaved={(summary, note) => {
                      setPaymentMethod(summary);
                      setDraft(null);
                      setMessage(note);
                    }}
                  />
                </Elements>
              )
            ) : (
              <p className="muted">Stripe publishable key is missing, so the live payment form cannot load.</p>
            )
          ) : (
            <p className="muted">Prepare setup to load the saved-card form.</p>
          )}
        </div>
      </section>
    </>
  );
}
