import { NextResponse } from "next/server";
import { retrievePaymentIntent } from "@/lib/payments/stripe";
import type { OrderDraft } from "@/lib/domain-types";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fulfillOrderAfterPayment } from "@/lib/orders/fulfillment";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to complete checkout." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const order = body?.order as OrderDraft | undefined;
  const paymentIntentId = String(body?.paymentIntentId ?? "");

  if (!order || !paymentIntentId) {
    return NextResponse.json({ message: "Order draft and payment intent ID are required." }, { status: 400 });
  }

  const storedOrder = await prisma.order.findFirst({
    where: {
      id: order.id,
      userId: user.id
    }
  });

  if (!storedOrder) {
    return NextResponse.json({ message: "Order draft not found for this account." }, { status: 404 });
  }

  const paymentIntent = await retrievePaymentIntent(paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json({
      payment: paymentIntent,
      note: "Payment is not complete yet. Confirm the payment intent before purchasing a label."
    }, { status: 409 });
  }

  const result = await fulfillOrderAfterPayment({
    orderId: storedOrder.id,
    paymentIntentId
  });

  return NextResponse.json({
    payment: paymentIntent,
    purchased: result.purchased,
    note: result.note,
    diagnostic: result.diagnostic,
    orderId: result.orderId ?? storedOrder.id
  });
}