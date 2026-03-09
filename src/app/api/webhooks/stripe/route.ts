import { NextResponse } from "next/server";
import { constructStripeWebhookEvent } from "@/lib/payments/stripe";
import { fulfillOrderAfterPayment, markOrderPaymentFailed } from "@/lib/orders/fulfillment";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ received: false, message: "Missing Stripe signature header." }, { status: 400 });
  }

  try {
    const event = await constructStripeWebhookEvent(payload, signature);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as { id: string; metadata?: Record<string, string> };
      await fulfillOrderAfterPayment({
        orderId: paymentIntent.metadata?.calfieOrderId,
        paymentIntentId: paymentIntent.id
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as { id: string; last_payment_error?: { message?: string } | null; metadata?: Record<string, string> };
      await markOrderPaymentFailed({
        orderId: paymentIntent.metadata?.calfieOrderId,
        paymentIntentId: paymentIntent.id,
        diagnostic: paymentIntent.last_payment_error?.message ?? "Stripe marked the payment intent as failed."
      });
    }

    return NextResponse.json({
      received: true,
      type: event.type,
      note: "Stripe webhook verified and processed."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Stripe webhook error";
    return NextResponse.json({ received: false, message }, { status: 400 });
  }
}