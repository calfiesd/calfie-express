import { prisma } from "@/lib/db";
import { UpsAdapter } from "@/lib/carriers/ups";
import { FedExAdapter } from "@/lib/carriers/fedex";
import type { CarrierAdapter } from "@/lib/carriers/base";
import type { CarrierRate, PurchasedLabel, ShipmentInput } from "@/lib/domain-types";
import { buildCarrierPurchaseDiagnostic } from "@/lib/carriers/diagnostics";
import { persistLabelAsset } from "@/lib/labels";
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

function getCarrierAdapter(carrier: CarrierRate["carrier"]): CarrierAdapter {
  return carrier === "FEDEX" ? new FedExAdapter() : new UpsAdapter();
}

async function sendPurchaseSuccessEmail(args: {
  email: string;
  orderId: string;
  amount: number;
  trackingNumber: string;
  labelUrl: string;
  carrier: CarrierRate["carrier"];
}) {
  await sendOrderEmail({
    to: args.email,
    subject: `CALFIE EXPRESS label purchased: ${args.orderId}`,
    htmlBody: `<p>Your ${args.carrier} label is ready.</p><p><strong>Order:</strong> ${args.orderId}<br/><strong>Tracking:</strong> ${args.trackingNumber}<br/><strong>Charged:</strong> $${args.amount.toFixed(2)}</p><p><a href="${args.labelUrl}">Open label</a></p>`,
    textBody: `Your ${args.carrier} label is ready.\nOrder: ${args.orderId}\nTracking: ${args.trackingNumber}\nCharged: $${args.amount.toFixed(2)}\nLabel: ${args.labelUrl}`
  }).catch(() => null);
}

async function sendPurchaseFailureEmail(args: {
  email: string;
  orderId: string;
  diagnostic: string;
  carrier: CarrierRate["carrier"];
}) {
  await sendOrderEmail({
    to: args.email,
    subject: `CALFIE EXPRESS payment received for ${args.orderId}`,
    htmlBody: `<p>Payment was received for order <strong>${args.orderId}</strong>, but automatic ${args.carrier} label purchase needs follow-up.</p><p>${args.diagnostic}</p>`,
    textBody: `Payment was received for order ${args.orderId}, but automatic ${args.carrier} label purchase needs follow-up.\n${args.diagnostic}`
  }).catch(() => null);
}

async function fulfillStoredOrder(args: {
  orderLookup: { id: string } | { stripePaymentIntentId: string };
  paymentIntentId?: string;
}) : Promise<FulfillmentResult> {
  const storedOrder = await prisma.order.findFirst({
    where: args.orderLookup,
    include: {
      user: { include: { pricingProfile: true } }
    }
  });

  if (!storedOrder) {
    return {
      note: "Payment succeeded, but no matching order was found.",
      purchased: null,
      diagnostic: args.paymentIntentId ? `No order matches payment intent ${args.paymentIntentId}.` : "No matching order was found."
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
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {})
      }
    }).catch(() => null);

    return {
      note: "Payment verified, but stored shipment data is incomplete.",
      purchased: null,
      diagnostic: "Stored shipmentJson or selectedRateJson is missing.",
      orderId: storedOrder.id
    };
  }

  if (rate.carrier === "UPS" && storedOrder.user.pricingProfile?.allowUpsPurchase === false) {
    return {
      note: "Payment verified, but UPS label purchase is disabled for this customer.",
      purchased: null,
      diagnostic: "UPS purchase is disabled by the customer purchase-access profile.",
      orderId: storedOrder.id
    };
  }

  if (rate.carrier === "FEDEX" && storedOrder.user.pricingProfile?.allowFedexPurchase === false) {
    return {
      note: "Payment verified, but FEDEX label purchase is disabled for this customer.",
      purchased: null,
      diagnostic: "FedEx purchase is disabled by the customer purchase-access profile.",
      orderId: storedOrder.id
    };
  }

  try {
    const purchased = await getCarrierAdapter(rate.carrier).buyLabel({
      orderId: storedOrder.id,
      shipment,
      rate
    });
    const storedLabelUrl = await persistLabelAsset({
      orderId: storedOrder.id,
      carrier: purchased.carrier,
      serviceName: purchased.serviceName,
      trackingNumber: purchased.trackingNumber,
      labelUrl: purchased.labelUrl
    });
    const storedPurchase = {
      ...purchased,
      labelUrl: storedLabelUrl
    };

    await prisma.order.update({
      where: { id: storedOrder.id },
      data: {
        status: "LABEL_PURCHASED",
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        actualCarrierAmount: storedPurchase.carrierCharge,
        trackingNumber: storedPurchase.trackingNumber,
        labelUrl: storedPurchase.labelUrl
      }
    });

    await sendPurchaseSuccessEmail({
      email: storedOrder.user.email,
      orderId: storedOrder.id,
      amount: Number(storedOrder.quotedCustomerAmount),
      trackingNumber: storedPurchase.trackingNumber,
      labelUrl: storedPurchase.labelUrl,
      carrier: rate.carrier
    });

    return {
      note: `Payment verified and ${rate.carrier} label purchased successfully. Order saved to PostgreSQL.`,
      purchased: storedPurchase,
      orderId: storedOrder.id
    };
  } catch (error) {
    const diagnostic = buildCarrierPurchaseDiagnostic({
      carrier: rate.carrier,
      shipment,
      error
    });

    await prisma.order.update({
      where: { id: storedOrder.id },
      data: {
        status: "PAID",
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {})
      }
    }).catch(() => null);

    await sendPurchaseFailureEmail({
      email: storedOrder.user.email,
      orderId: storedOrder.id,
      diagnostic,
      carrier: rate.carrier
    });

    return {
      note: `Payment verified, but ${rate.carrier} label purchase failed. Payment state saved.`,
      purchased: null,
      diagnostic,
      orderId: storedOrder.id
    };
  }
}

export async function fulfillOrderAfterPayment(args: {
  orderId?: string;
  paymentIntentId: string;
}) : Promise<FulfillmentResult> {
  return fulfillStoredOrder({
    orderLookup: args.orderId ? { id: args.orderId } : { stripePaymentIntentId: args.paymentIntentId },
    paymentIntentId: args.paymentIntentId
  });
}

export async function fulfillOrderFromWallet(args: {
  orderId: string;
}) : Promise<FulfillmentResult> {
  return fulfillStoredOrder({
    orderLookup: { id: args.orderId }
  });
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
      user: { include: { pricingProfile: true } }
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
