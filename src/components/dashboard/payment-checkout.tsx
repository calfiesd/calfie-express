"use client";

import { FormEvent, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { CheckoutDraft, OrderDraft, PurchasedLabel } from "@/lib/domain-types";

type PaymentCheckoutProps = {
  publishableKey: string;
  checkoutDraft: CheckoutDraft;
  orderDraft: OrderDraft;
  onCompleted(result: {
    note: string;
    purchased: PurchasedLabel | null;
    diagnostic?: string;
  }): void;
};

type InnerProps = PaymentCheckoutProps;

function InnerPaymentForm({ checkoutDraft, orderDraft, onCompleted }: InnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitDemo() {
    const response = await fetch("/api/orders/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order: orderDraft,
        paymentIntentId: checkoutDraft.paymentIntentId
      })
    });

    const payload = await response.json();
    onCompleted({
      note: payload.note,
      purchased: payload.purchased,
      diagnostic: payload.diagnostic
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (checkoutDraft.paymentMode === "demo") {
      setSubmitting(true);
      await submitDemo();
      setSubmitting(false);
      return;
    }

    if (!stripe || !elements) {
      setMessage("Stripe Elements is still loading.");
      return;
    }

    setSubmitting(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      setMessage(result.error.message ?? "Payment confirmation failed.");
      setSubmitting(false);
      return;
    }

    const paymentIntentId = result.paymentIntent?.id ?? checkoutDraft.paymentIntentId;
    const response = await fetch("/api/orders/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order: orderDraft,
        paymentIntentId
      })
    });

    const payload = await response.json();
    onCompleted({
      note: payload.note,
      purchased: payload.purchased,
      diagnostic: payload.diagnostic
    });
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {checkoutDraft.paymentMode === "live" ? <PaymentElement /> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "Confirming payment..." : checkoutDraft.paymentMode === "live" ? "Pay and buy label" : "Simulate payment completion"}
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}

export function PaymentCheckout(props: PaymentCheckoutProps) {
  const stripePromise = useMemo(() => {
    if (!props.publishableKey) {
      return null;
    }

    return loadStripe(props.publishableKey);
  }, [props.publishableKey]);

  if (props.checkoutDraft.paymentMode === "demo") {
    return <InnerPaymentForm {...props} />;
  }

  if (!stripePromise) {
    return <p className="muted">Stripe publishable key is missing, so the payment form cannot load.</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.checkoutDraft.clientSecret }}>
      <InnerPaymentForm {...props} />
    </Elements>
  );
}