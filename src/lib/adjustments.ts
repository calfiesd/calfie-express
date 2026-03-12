import { AdjustmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAdjustmentCharge } from "@/lib/payments/stripe";
import { sendOrderEmail } from "@/lib/notifications/email";

const adjustmentInclude = {
  order: {
    select: {
      id: true,
      status: true,
      selectedCarrier: true,
      selectedService: true,
      trackingNumber: true,
      labelUrl: true,
      quotedCarrierAmount: true,
      quotedCustomerAmount: true
    }
  },
  customer: {
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      stripeCustomerId: true
    }
  }
} satisfies Prisma.CarrierAdjustmentInclude;

export type CarrierAdjustmentRecord = Prisma.CarrierAdjustmentGetPayload<{
  include: typeof adjustmentInclude;
}>;

type CreateCarrierAdjustmentArgs = {
  orderId: string;
  reason: string;
  carrierBilledAmount: number;
  originalQuotedAmount?: number;
  amountToCharge?: number;
};

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function normalizeOptionalAmount(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? roundCurrency(value as number) : roundCurrency(fallback);
}

async function sendAdjustmentEmail(args: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}) {
  await sendOrderEmail(args).catch(() => null);
}

async function notifyAdjustmentCreated(adjustment: CarrierAdjustmentRecord) {
  await sendAdjustmentEmail({
    to: adjustment.customer.email,
    subject: `CALFIE EXPRESS adjustment opened: ${adjustment.id}`,
    htmlBody: `<p>A carrier adjustment has been opened for order <strong>${adjustment.order.id}</strong>.</p><p><strong>Reason:</strong> ${adjustment.reason}<br/><strong>Original quoted carrier amount:</strong> $${Number(adjustment.originalQuotedAmount).toFixed(2)}<br/><strong>Carrier billed amount:</strong> $${Number(adjustment.carrierBilledAmount).toFixed(2)}<br/><strong>Customer adjustment amount:</strong> $${Number(adjustment.amountToCharge).toFixed(2)}</p>`,
    textBody: `A carrier adjustment has been opened for order ${adjustment.order.id}.\nReason: ${adjustment.reason}\nOriginal quoted carrier amount: $${Number(adjustment.originalQuotedAmount).toFixed(2)}\nCarrier billed amount: $${Number(adjustment.carrierBilledAmount).toFixed(2)}\nCustomer adjustment amount: $${Number(adjustment.amountToCharge).toFixed(2)}`
  });
}

async function notifyAdjustmentBilled(adjustment: CarrierAdjustmentRecord) {
  await sendAdjustmentEmail({
    to: adjustment.customer.email,
    subject: `CALFIE EXPRESS adjustment billed: ${adjustment.id}`,
    htmlBody: `<p>Your carrier adjustment for order <strong>${adjustment.order.id}</strong> has been billed.</p><p><strong>Amount:</strong> $${Number(adjustment.amountToCharge).toFixed(2)}<br/><strong>Reason:</strong> ${adjustment.reason}</p><p>You can review the current status from the customer portal adjustments page.</p>`,
    textBody: `Your carrier adjustment for order ${adjustment.order.id} has been billed.\nAmount: $${Number(adjustment.amountToCharge).toFixed(2)}\nReason: ${adjustment.reason}\nReview it in the customer portal adjustments page.`
  });
}

async function notifyAdjustmentResolved(adjustment: CarrierAdjustmentRecord) {
  const resolutionLabel = adjustment.status === "WAIVED" ? "waived" : adjustment.status === "PAID" ? "marked paid" : adjustment.status.toLowerCase();

  await sendAdjustmentEmail({
    to: adjustment.customer.email,
    subject: `CALFIE EXPRESS adjustment updated: ${adjustment.id}`,
    htmlBody: `<p>Your carrier adjustment for order <strong>${adjustment.order.id}</strong> was ${resolutionLabel}.</p><p><strong>Amount:</strong> $${Number(adjustment.amountToCharge).toFixed(2)}<br/><strong>Reason:</strong> ${adjustment.reason}<br/><strong>Status:</strong> ${adjustment.status}</p>`,
    textBody: `Your carrier adjustment for order ${adjustment.order.id} was ${resolutionLabel}.\nAmount: $${Number(adjustment.amountToCharge).toFixed(2)}\nReason: ${adjustment.reason}\nStatus: ${adjustment.status}`
  });
}

async function syncOrderAdjustmentStatus(orderId: string) {
  const [unresolvedCount, order] = await Promise.all([
    prisma.carrierAdjustment.count({
      where: {
        orderId,
        status: {
          in: ["PENDING", "BILLED", "FAILED"]
        }
      }
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        labelUrl: true
      }
    })
  ]);

  if (!order) {
    return;
  }

  if (unresolvedCount > 0) {
    if (order.status !== "ADJUSTMENT_PENDING") {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "ADJUSTMENT_PENDING"
        }
      });
    }
    return;
  }

  if (order.status === "ADJUSTMENT_PENDING") {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: order.trackingNumber || order.labelUrl ? "COMPLETED" : "PAID"
      }
    });
  }
}

export async function getAdminCarrierAdjustments() {
  return prisma.carrierAdjustment.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: adjustmentInclude
  });
}

export async function getCustomerCarrierAdjustments(userId: string) {
  return prisma.carrierAdjustment.findMany({
    where: {
      customerId: userId
    },
    orderBy: {
      createdAt: "desc"
    },
    include: adjustmentInclude
  });
}

export async function getCustomerAdjustmentSummary(userId: string) {
  const adjustments = await prisma.carrierAdjustment.findMany({
    where: {
      customerId: userId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      status: true,
      amountToCharge: true,
      createdAt: true,
      orderId: true,
      reason: true
    }
  });

  const unresolved = adjustments.filter((item) => ["PENDING", "BILLED", "FAILED"].includes(item.status));

  return {
    totalCount: adjustments.length,
    unresolvedCount: unresolved.length,
    outstandingAmount: unresolved.reduce((sum, item) => sum + Number(item.amountToCharge), 0),
    latest: adjustments[0]
      ? {
          id: adjustments[0].id,
          status: adjustments[0].status,
          orderId: adjustments[0].orderId,
          reason: adjustments[0].reason,
          createdAt: adjustments[0].createdAt.toISOString()
        }
      : null
  };
}

export async function createCarrierAdjustment(args: CreateCarrierAdjustmentArgs) {
  const order = await prisma.order.findUnique({
    where: {
      id: args.orderId
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          companyName: true,
          stripeCustomerId: true,
          role: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.user.role !== "CUSTOMER") {
    throw new Error("Carrier adjustments can only be attached to customer orders.");
  }

  const reason = args.reason.trim();
  if (!reason) {
    throw new Error("Adjustment reason is required.");
  }

  const baseQuotedAmount = Number(order.actualCarrierAmount ?? order.quotedCarrierAmount ?? 0);
  const originalQuotedAmount = normalizeOptionalAmount(args.originalQuotedAmount, baseQuotedAmount);
  const carrierBilledAmount = normalizeOptionalAmount(args.carrierBilledAmount, 0);
  const amountToCharge = Number.isFinite(args.amountToCharge)
    ? roundCurrency(args.amountToCharge as number)
    : roundCurrency(Math.max(0, carrierBilledAmount - originalQuotedAmount));

  if (carrierBilledAmount <= 0) {
    throw new Error("Carrier billed amount must be greater than zero.");
  }

  if (amountToCharge <= 0) {
    throw new Error("Amount to charge must be greater than zero.");
  }

  const duplicateOpenAdjustment = await prisma.carrierAdjustment.findFirst({
    where: {
      orderId: order.id,
      reason,
      amountToCharge,
      status: {
        in: ["PENDING", "BILLED"]
      }
    }
  });

  if (duplicateOpenAdjustment) {
    throw new Error("A matching open adjustment already exists for this order.");
  }

  const created = await prisma.carrierAdjustment.create({
    data: {
      orderId: order.id,
      customerId: order.userId,
      carrierCode: order.selectedCarrier,
      reason,
      originalQuotedAmount,
      carrierBilledAmount,
      amountToCharge,
      status: "PENDING"
    },
    include: adjustmentInclude
  });

  await syncOrderAdjustmentStatus(order.id);
  await notifyAdjustmentCreated(created);
  return created;
}

export async function billCarrierAdjustment(id: string) {
  const adjustment = await prisma.carrierAdjustment.findUnique({
    where: { id },
    include: adjustmentInclude
  });

  if (!adjustment) {
    throw new Error("Adjustment not found.");
  }

  if (!["PENDING", "FAILED"].includes(adjustment.status)) {
    throw new Error("Only pending or failed adjustments can be billed.");
  }

  const result = await createAdjustmentCharge({
    user: {
      id: adjustment.customer.id,
      email: adjustment.customer.email,
      name: adjustment.customer.name,
      companyName: adjustment.customer.companyName,
      stripeCustomerId: adjustment.customer.stripeCustomerId
    },
    amount: Number(adjustment.amountToCharge),
    reason: adjustment.reason,
    adjustmentId: adjustment.id,
    orderId: adjustment.order.id
  });

  const updated = await prisma.carrierAdjustment.update({
    where: { id: adjustment.id },
    data: {
      status: "BILLED",
      stripeInvoiceItemId: result.invoiceItemId ?? result.invoiceId ?? adjustment.stripeInvoiceItemId
    },
    include: adjustmentInclude
  });

  await syncOrderAdjustmentStatus(updated.orderId);
  await notifyAdjustmentBilled(updated);
  return { adjustment: updated, billing: result };
}

export async function updateCarrierAdjustmentStatus(id: string, status: AdjustmentStatus) {
  const adjustment = await prisma.carrierAdjustment.findUnique({
    where: { id },
    include: adjustmentInclude
  });

  if (!adjustment) {
    throw new Error("Adjustment not found.");
  }

  const updated = await prisma.carrierAdjustment.update({
    where: { id: adjustment.id },
    data: {
      status
    },
    include: adjustmentInclude
  });

  await syncOrderAdjustmentStatus(updated.orderId);

  if (status === "PAID" || status === "WAIVED") {
    await notifyAdjustmentResolved(updated);
  }

  return updated;
}
