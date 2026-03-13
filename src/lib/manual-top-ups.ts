import { prisma } from "@/lib/db";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getCustomerManualTopUpRequests(userId: string) {
  const requests = await prisma.manualTopUpRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 12
  });

  return requests.map((request) => ({
    id: request.id,
    amount: Number(request.amount),
    paymentMethod: request.paymentMethod,
    reference: request.reference,
    note: request.note,
    status: request.status,
    processedAt: request.processedAt?.toISOString() ?? null,
    processedByAdmin: request.processedByAdmin,
    walletTransactionId: request.walletTransactionId,
    createdAt: request.createdAt.toISOString()
  }));
}

export async function createManualTopUpRequest(args: {
  userId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  note?: string;
}) {
  const amount = roundMoney(args.amount);
  if (!(amount > 0)) {
    throw new Error("Manual top-up amount must be greater than zero.");
  }

  const paymentMethod = args.paymentMethod.trim();
  if (!paymentMethod) {
    throw new Error("Payment method is required.");
  }

  const created = await prisma.manualTopUpRequest.create({
    data: {
      userId: args.userId,
      amount,
      paymentMethod,
      reference: args.reference?.trim() || null,
      note: args.note?.trim() || null,
      status: "PENDING"
    }
  });

  return {
    id: created.id,
    amount: Number(created.amount),
    paymentMethod: created.paymentMethod,
    reference: created.reference,
    note: created.note,
    status: created.status,
    processedAt: null,
    processedByAdmin: null,
    walletTransactionId: null,
    createdAt: created.createdAt.toISOString()
  };
}

export async function completeManualTopUpRequest(args: {
  requestId: string;
  adminEmail: string;
  walletTransactionId?: string | null;
}) {
  return prisma.manualTopUpRequest.update({
    where: { id: args.requestId },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      processedByAdmin: args.adminEmail,
      walletTransactionId: args.walletTransactionId ?? null
    }
  });
}
