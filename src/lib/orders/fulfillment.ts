import { prisma } from "@/lib/db";
import { UpsAdapter } from "@/lib/carriers/ups";
import type { CarrierRate, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";
import { sendOrderEmail } from "@/lib/notifications/email";

type FulfillmentResult = {
  note: string;
  purchased: PurchasedLabel | null;
  diagnostic?: string;
  orderId?: string;
};

function existingPurchase(order: {
  selectedCarrier: "UPS" | "FEDEX";
  selectedService: string;
  trackingNumber: string | null;
  labelUrl: string | null;
  actualCarrierAmount: unknown;
}) {
  if (!order.trackingNumber || !order.labelUrl) {
    return null;
  }

  return {
    carrier: order.selectedCarrier,
    serviceName: order.selectedService,
    trackingNumber: order.trackingNumber,
    labelUrl: order.labelUrl,
    carrierCharge: Number(order.actualCarrierAmount ?? 0)
  } satisfies PurchasedLabel;
}

async function sendPurchaseSuccessEmail(args: {
  email: string;
  orderId: string;
  amount: number;
  trackingNumber: string;
  labelUrl: string;
}) {
  await sendOrderEmail({
    to: args.email,
    subject: `CALFIE EXPRESS label purchased: ${args.orderId}`,
    htmlBody: `<p>Your UPS label is ready.</p><p><strong>Order:</strong> ${args.orderId}<br/><strong>Tracking:</strong> ${args.trackingNumber}<br/><strong>Charged:</strong> $${args.amount.toFixed(2)}</p><p><a href="${args.labelUrl}">Open label</a></p>`,
    textBody: `Your UPS label is ready.\nOrder: ${args.orderId}\nTracking: ${args.trackingNumber}\nCharged: $${args.amount.toFixed(2)}\nLabel: ${args.labelUrl}`
  }).catch(() => null);
}

async function sendPurchaseFailureEmail(args: {
  email: string;
  orderId: string;
  diagnostic: string;
}) {
  await sendOrderEmail({
    to: args.email,
    subject: `CALFIE EXPRESS payment received for ${args.orderId}`,
    htmlBody: `<p>Payment was received for order <strong>${args.orderId}</strong>, but automatic label purchase needs follow-up.</p><p>${args.diagnostic}</p>`,
    textBody: `Payment was received for order ${args.orderId}, but automatic label purchase needs follow-up.\n${args.diagnostic}`
  }).catch(() => null);
}

export async function fulfillOrderAfterPayment(args: {
  orderId?: string;
  paymentIntentId: string;
}) : Promise<FulfillmentResult> {
  const storedOrder = await prisma.order.findFirst({
    where: args.orderId
      ? { id: args.orderId }
      : { stripePaymentIntentId: args.paymentIntentId },
    include: {
      user: true
    }
  });

  if (!storedOrder) {
    return {
      note: "Payment succeeded, but no matching order was found.",
      purchased: null,
      diagnostic: `No order matches payment intent ${args.paymentIntentId}.`
    };
  }

  const alreadyPurchased = existingPurchase(storedOrder);
  if (storedOrder.status === "LABEL_PURCHASED" && alreadyPurchased) {
    return {
      note: "Payment was already fulfilled for this order.",
      purchased: alreadyPurchased,
      orderId: storedOrder.id
    };
  }

  const shipment = storedOrder.shipmentJson as ShipmentInput | null;
  const rate = storedOrder.selectedRateJson as CarrierRate | null;

  if (!shipment || !rate) {
    await prisma.order.update({
      where: { id: storedOrder.id },
      data: {
        status: "PAID",
        stripePaymentIntentId: args.paymentIntentId
      }
    }).catch(() => null);

    return {
      note: "Payment verified, but stored shipment data is incomplete.",
      purchased: null,
      diagnostic: "Stored shipmentJson or selectedRateJson is missing.",
      orderId: storedOrder.id
    };
  }

  try {
    const purchased = await new UpsAdapter().buyLabel({
      orderId: storedOrder.id,
      shipment,
      rate
    });

    await prisma.order.update({
      where: { id: storedOrder.id },
      data: {
        status: "LABEL_PURCHASED",
        stripePaymentIntentId: args.paymentIntentId,
        actualCarrierAmount: purchased.carrierCharge,
        trackingNumber: purchased.trackingNumber,
        labelUrl: purchased.labelUrl
      }
    });

    await sendPurchaseSuccessEmail({
      email: storedOrder.user.email,
      orderId: storedOrder.id,
      amount: Number(storedOrder.quotedCustomerAmount),
      trackingNumber: purchased.trackingNumber,
      labelUrl: purchased.labelUrl
    });

    return {
      note: "Payment verified and UPS label purchased successfully. Order saved to PostgreSQL.",
      purchased,
      orderId: storedOrder.id
    };
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : "Unknown UPS purchase error";

    await prisma.order.update({
      where: { id: storedOrder.id },
      data: {
        status: "PAID",
        stripePaymentIntentId: args.paymentIntentId
      }
    }).catch(() => null);

    await sendPurchaseFailureEmail({
      email: storedOrder.user.email,
      orderId: storedOrder.id,
      diagnostic
    });

    return {
      note: "Payment verified, but UPS label purchase failed. Payment state saved.",
      purchased: null,
      diagnostic,
      orderId: storedOrder.id
    };
  }
}

export async function markOrderPaymentFailed(args: {
  paymentIntentId: string;
  orderId?: string;
  diagnostic: string;
}) {
  const storedOrder = await prisma.order.findFirst({
    where: args.orderId
      ? { id: args.orderId }
      : { stripePaymentIntentId: args.paymentIntentId },
    include: {
      user: true
    }
  });

  if (!storedOrder) {
    return null;
  }

  await prisma.order.update({
    where: { id: storedOrder.id },
    data: {
      status: "FAILED",
      stripePaymentIntentId: args.paymentIntentId
    }
  });

  await sendOrderEmail({
    to: storedOrder.user.email,
    subject: `CALFIE EXPRESS payment failed: ${storedOrder.id}`,
    htmlBody: `<p>Your payment did not complete for order <strong>${storedOrder.id}</strong>.</p><p>${args.diagnostic}</p>`,
    textBody: `Your payment did not complete for order ${storedOrder.id}.\n${args.diagnostic}`
  }).catch(() => null);

  return storedOrder.id;
}