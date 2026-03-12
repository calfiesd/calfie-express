import { prisma } from "@/lib/db";
import { createWalletPaymentIntent, retrievePaymentIntent } from "@/lib/payments/stripe";

type WalletUser = {
  id: string;
  email: string;
  name: string;
  companyName?: string | null;
  stripeCustomerId?: string | null;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getWalletSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      walletBalance: true,
      walletTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          order: {
            select: {
              id: true,
              selectedCarrier: true,
              selectedService: true,
              status: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  return {
    balance: Number(user.walletBalance),
    transactions: user.walletTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      balanceBefore: Number(transaction.balanceBefore),
      balanceAfter: Number(transaction.balanceAfter),
      description: transaction.description,
      stripePaymentIntentId: transaction.stripePaymentIntentId,
      createdAt: transaction.createdAt.toISOString(),
      order: transaction.order
        ? {
            id: transaction.order.id,
            selectedCarrier: transaction.order.selectedCarrier,
            selectedService: transaction.order.selectedService,
            status: transaction.order.status
          }
        : null
    }))
  };
}

export async function createWalletTopUpDraft(args: {
  user: WalletUser;
  amount: number;
}) {
  return createWalletPaymentIntent({
    amount: roundMoney(args.amount),
    user: args.user
  });
}

export async function creditWalletFromPaymentIntent(args: {
  paymentIntentId: string;
  userId?: string;
  fallbackAmount?: number;
}) {
  const paymentIntent = await retrievePaymentIntent(args.paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Wallet top-up payment is not complete yet.");
  }

  const metadata = (paymentIntent.metadata ?? null) as Record<string, string | undefined> | null;
  const userId = args.userId ?? metadata?.calfieUserId;
  if (!userId) {
    throw new Error("Wallet top-up is missing the target customer ID.");
  }

  const existing = await prisma.walletTransaction.findUnique({
    where: {
      stripePaymentIntentId: args.paymentIntentId
    }
  });

  if (existing) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true }
    });

    return {
      created: false,
      balance: Number(user?.walletBalance ?? existing.balanceAfter),
      transactionId: existing.id
    };
  }

  const rawAmount = paymentIntent.amount ?? args.fallbackAmount;
  const amount = roundMoney(Number(rawAmount ?? 0));

  if (!(amount > 0)) {
    throw new Error("Wallet top-up amount is missing or invalid.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true }
    });

    if (!user) {
      throw new Error("Customer account for wallet top-up was not found.");
    }

    const duplicate = await tx.walletTransaction.findUnique({
      where: {
        stripePaymentIntentId: args.paymentIntentId
      }
    });

    if (duplicate) {
      return {
        created: false,
        balance: Number(user.walletBalance),
        transactionId: duplicate.id
      };
    }

    const balanceBefore = Number(user.walletBalance);
    const balanceAfter = roundMoney(balanceBefore + amount);

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: "TOP_UP",
        status: "COMPLETED",
        amount,
        balanceBefore,
        balanceAfter,
        description: `Wallet top-up from payment intent ${args.paymentIntentId}`,
        stripePaymentIntentId: args.paymentIntentId,
        metadataJson: {
          source: "stripe",
          paymentIntentId: args.paymentIntentId,
          metadata
        }
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        walletBalance: balanceAfter
      }
    });

    return {
      created: true,
      balance: balanceAfter,
      transactionId: transaction.id
    };
  });
}

export async function applyAdminWalletAdjustment(args: {
  userId: string;
  amount: number;
  note?: string;
  adminEmail?: string;
}) {
  const signedAmount = roundMoney(args.amount);
  if (!signedAmount) {
    throw new Error("Adjustment amount must be greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: args.userId },
      select: {
        id: true,
        email: true,
        walletBalance: true
      }
    });

    if (!user) {
      throw new Error("Customer not found for wallet adjustment.");
    }

    const balanceBefore = Number(user.walletBalance);
    const balanceAfter = roundMoney(balanceBefore + signedAmount);

    if (balanceAfter < 0) {
      throw new Error(`Adjustment would overdraw wallet. Available ${balanceBefore.toFixed(2)}.`);
    }

    const transaction = await tx.walletTransaction.create({
      data: {
        userId: user.id,
        type: signedAmount > 0 ? "MANUAL_CREDIT" : "MANUAL_DEBIT",
        status: "COMPLETED",
        amount: signedAmount,
        balanceBefore,
        balanceAfter,
        description: args.note?.trim() || (signedAmount > 0 ? "Admin wallet credit" : "Admin wallet debit"),
        metadataJson: {
          source: "admin",
          adminEmail: args.adminEmail ?? null
        }
      }
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        walletBalance: balanceAfter
      }
    });

    return {
      transactionId: transaction.id,
      balance: balanceAfter,
      amount: signedAmount,
      userEmail: user.email
    };
  });
}

export async function payOrderWithWallet(args: {
  orderId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: args.orderId,
        userId: args.userId
      },
      include: {
        user: {
          include: {
            pricingProfile: true
          }
        }
      }
    });

    if (!order) {
      throw new Error("Order draft not found for this account.");
    }

    if (order.paymentSource === "WALLET" && ["PAID", "LABEL_PURCHASED"].includes(order.status)) {
      const existingTransaction = await tx.walletTransaction.findFirst({
        where: {
          orderId: order.id,
          type: "LABEL_PURCHASE",
          status: "COMPLETED"
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return {
        orderId: order.id,
        amount: Number(order.walletDebitedAmount || order.quotedCustomerAmount),
        walletBalance: Number(order.user.walletBalance),
        transactionId: existingTransaction?.id ?? null,
        alreadyPaid: true
      };
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new Error(`Order ${order.id} cannot be paid from wallet in status ${order.status}.`);
    }

    if (order.selectedCarrier === "UPS" && order.user.pricingProfile?.allowUpsPurchase === false) {
      throw new Error("UPS purchase is disabled for this customer.");
    }

    if (order.selectedCarrier === "FEDEX" && order.user.pricingProfile?.allowFedexPurchase === false) {
      throw new Error("FedEx purchase is disabled for this customer.");
    }

    const amount = roundMoney(Number(order.quotedCustomerAmount));
    const balanceBefore = Number(order.user.walletBalance);

    if (balanceBefore < amount) {
      throw new Error(`Wallet balance is too low. Available ${balanceBefore.toFixed(2)}, required ${amount.toFixed(2)}.`);
    }

    const balanceAfter = roundMoney(balanceBefore - amount);

    const transaction = await tx.walletTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: "LABEL_PURCHASE",
        status: "COMPLETED",
        amount: -amount,
        balanceBefore,
        balanceAfter,
        description: `Wallet payment for order ${order.id}`,
        metadataJson: {
          selectedCarrier: order.selectedCarrier,
          selectedService: order.selectedService
        }
      }
    });

    await tx.user.update({
      where: { id: order.userId },
      data: {
        walletBalance: balanceAfter
      }
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentSource: "WALLET",
        walletDebitedAmount: amount,
        stripePaymentIntentId: null,
        status: "PAID"
      }
    });

    return {
      orderId: order.id,
      amount,
      walletBalance: balanceAfter,
      transactionId: transaction.id,
      alreadyPaid: false
    };
  });
}

export async function refundWalletOrder(args: {
  orderId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: args.orderId },
      include: {
        user: true
      }
    });

    if (!order) {
      throw new Error("Order not found for wallet refund.");
    }

    if (order.paymentSource !== "WALLET") {
      return null;
    }

    const existing = await tx.walletTransaction.findFirst({
      where: {
        orderId: order.id,
        type: "VOID_REFUND",
        status: "COMPLETED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (existing) {
      return {
        transactionId: existing.id,
        amount: Number(existing.amount),
        balance: Number(existing.balanceAfter),
        created: false
      };
    }

    const refundAmount = roundMoney(Number(order.walletDebitedAmount));
    if (!(refundAmount > 0)) {
      return null;
    }

    const balanceBefore = Number(order.user.walletBalance);
    const balanceAfter = roundMoney(balanceBefore + refundAmount);

    const transaction = await tx.walletTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: "VOID_REFUND",
        status: "COMPLETED",
        amount: refundAmount,
        balanceBefore,
        balanceAfter,
        description: `Wallet refund for order ${order.id}`,
        metadataJson: {
          reason: "void_or_refund"
        }
      }
    });

    await tx.user.update({
      where: { id: order.userId },
      data: {
        walletBalance: balanceAfter
      }
    });

    return {
      transactionId: transaction.id,
      amount: refundAmount,
      balance: balanceAfter,
      created: true
    };
  });
}



