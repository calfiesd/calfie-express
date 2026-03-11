import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import { refundPaymentIntent } from "@/lib/payments/stripe";
import type { CarrierRate, ShipmentInput } from "@/lib/domain-types";

function getCarrierAdapter(carrier: "UPS" | "FEDEX") {
  return carrier === "FEDEX" ? new FedExAdapter() : new UpsAdapter();
}

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
    },
    include: {
      user: true
    }
  });

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  if (!["LABEL_PURCHASED", "PAID", "VOID_REQUESTED"].includes(order.status)) {
    return NextResponse.json(
      { message: `Order ${order.id} cannot be voided from status ${order.status}.` },
      { status: 400 }
    );
  }

  const shipment = order.shipmentJson as ShipmentInput | null;
  const rate = order.selectedRateJson as CarrierRate | null;

  if (!rate) {
    return NextResponse.json({ message: "Selected rate is missing on this order." }, { status: 400 });
  }

  const carrierResult = await getCarrierAdapter(order.selectedCarrier).voidLabel({
    orderId: order.id,
    trackingNumber: order.trackingNumber,
    shipment,
    rate
  });

  let stripeRefund: {
    mode: "live" | "demo";
    refundId: string;
    status: string;
  } | null = null;
  let nextStatus: "VOID_REQUESTED" | "VOIDED" | "REFUNDED" = "VOID_REQUESTED";
  const diagnostics: string[] = [];

  if (carrierResult.diagnostic) {
    diagnostics.push(carrierResult.diagnostic);
  }

  if (carrierResult.accepted) {
    nextStatus = "VOIDED";

    if (order.stripePaymentIntentId) {
      stripeRefund = await refundPaymentIntent({
        paymentIntentId: order.stripePaymentIntentId,
        reason: "requested_by_customer"
      });
      diagnostics.push(`Stripe refund ${stripeRefund.status} (${stripeRefund.mode}).`);

      if (stripeRefund.status === "succeeded") {
        nextStatus = "REFUNDED";
      }
    }
  } else {
    diagnostics.push("Carrier void still needs manual follow-up before refunding the customer.");
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: nextStatus }
  });

  return NextResponse.json({
    message:
      nextStatus === "REFUNDED"
        ? `Order ${updated.id} was voided and refunded.`
        : nextStatus === "VOIDED"
          ? `Order ${updated.id} was voided.`
          : `Void/refund requested for order ${updated.id}.`,
    orderId: updated.id,
    status: updated.status,
    carrierResult,
    stripeRefund,
    diagnostic: diagnostics.join(" ")
  });
}