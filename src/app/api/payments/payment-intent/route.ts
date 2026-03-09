import { NextResponse } from "next/server";
import { createPaymentIntent } from "@/lib/payments/stripe";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to prepare checkout." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const order = body?.order;

  if (!order?.id) {
    return NextResponse.json({ message: "An order draft is required." }, { status: 400 });
  }

  const storedOrder = await prisma.order.findFirst({
    where: {
      id: String(order.id),
      userId: user.id
    }
  });

  if (!storedOrder) {
    return NextResponse.json({ message: "Order draft not found for this account." }, { status: 404 });
  }

  const amount = Number(storedOrder.quotedCustomerAmount);
  const payment = await createPaymentIntent({
    amount,
    orderId: storedOrder.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      stripeCustomerId: user.stripeCustomerId
    }
  });

  await prisma.order.update({
    where: { id: storedOrder.id },
    data: {
      stripePaymentIntentId: payment.paymentIntentId
    }
  });

  return NextResponse.json({
    checkout: {
      orderId: storedOrder.id,
      amount: payment.amount,
      currency: payment.currency,
      paymentMode: payment.paymentMode,
      clientSecret: payment.clientSecret,
      paymentIntentId: payment.paymentIntentId,
      status: payment.status
    },
    note: "Checkout draft created for the signed-in customer. Stripe webhooks can now fulfill this order automatically."
  });
}