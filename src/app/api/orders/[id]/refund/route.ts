import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { refundPaymentIntent } from "@/lib/payments/stripe";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN" ? {} : { userId: user.id })
    }
  });

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  if (order.status !== "VOID_REQUESTED") {
    return NextResponse.json(
      { message: `Order ${order.id} must be in VOID_REQUESTED before marking it refunded.` },
      { status: 400 }
    );
  }

  let stripeRefund: { mode: "live" | "demo"; refundId: string; status: string } | null = null;
  const diagnostics: string[] = ["Carrier void confirmed manually by admin/user."];

  if (order.stripePaymentIntentId) {
    stripeRefund = await refundPaymentIntent({
      paymentIntentId: order.stripePaymentIntentId,
      reason: "requested_by_customer"
    });
    diagnostics.push(`Stripe refund ${stripeRefund.status} (${stripeRefund.mode}).`);
  } else {
    diagnostics.push("No Stripe payment intent was attached to this order.");
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "REFUNDED" }
  });

  return NextResponse.json({
    message: `Order ${updated.id} marked refunded.` ,
    orderId: updated.id,
    status: updated.status,
    stripeRefund,
    diagnostic: diagnostics.join(" ")
  });
}