import { prisma } from "@/lib/db";

function sumNumbers(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function getAdminReconciliationSnapshot(days: number) {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 365) : 30;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (safeDays - 1));

  const [
    orders,
    openAdjustments,
    recentAdjustments,
    walletTransactions,
    walletFailures,
    users,
    recentOrdersNeedingAttention
  ] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            email: true,
            companyName: true
          }
        }
      }
    }),
    prisma.carrierAdjustment.findMany({
      where: {
        status: {
          in: ["PENDING", "BILLED", "FAILED"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        customer: {
          select: {
            email: true,
            companyName: true
          }
        },
        order: {
          select: {
            selectedCarrier: true,
            trackingNumber: true
          }
        }
      }
    }),
    prisma.carrierAdjustment.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12,
      include: {
        customer: {
          select: {
            email: true,
            companyName: true
          }
        },
        order: {
          select: {
            id: true,
            selectedCarrier: true,
            trackingNumber: true
          }
        }
      }
    }),
    prisma.walletTransaction.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            email: true,
            companyName: true
          }
        },
        order: {
          select: {
            id: true,
            selectedCarrier: true,
            status: true
          }
        }
      }
    }),
    prisma.walletTransaction.findMany({
      where: {
        status: "FAILED"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10,
      include: {
        user: {
          select: {
            email: true,
            companyName: true
          }
        },
        order: {
          select: {
            id: true,
            selectedCarrier: true,
            status: true
          }
        }
      }
    }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        companyName: true,
        walletBalance: true
      }
    }),
    prisma.order.findMany({
      where: {
        OR: [
          {
            status: "PAID",
            labelUrl: null
          },
          {
            status: "ADJUSTMENT_PENDING"
          },
          {
            status: "FAILED"
          }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 12,
      include: {
        user: {
          select: {
            email: true,
            companyName: true
          }
        }
      }
    })
  ]);

  const quotedRevenue = roundMoney(sumNumbers(orders.map((order) => Number(order.quotedCustomerAmount))));
  const quotedCarrierCost = roundMoney(sumNumbers(orders.map((order) => Number(order.quotedCarrierAmount))));
  const actualCarrierCost = roundMoney(sumNumbers(orders.map((order) => Number(order.actualCarrierAmount ?? 0))));
  const walletCollected = roundMoney(sumNumbers(orders.map((order) => Number(order.walletDebitedAmount ?? 0))));
  const stripeCollected = roundMoney(sumNumbers(
    orders
      .filter((order) => order.paymentSource === "STRIPE" && ["PAID", "LABEL_PURCHASED", "COMPLETED", "ADJUSTMENT_PENDING", "VOIDED", "REFUNDED"].includes(order.status))
      .map((order) => Number(order.quotedCustomerAmount))
  ));
  const openAdjustmentAmount = roundMoney(sumNumbers(openAdjustments.map((item) => Number(item.amountToCharge))));
  const walletLiability = roundMoney(sumNumbers(users.map((user) => Number(user.walletBalance))));
  const topUps = roundMoney(sumNumbers(
    walletTransactions
      .filter((item) => item.type === "TOP_UP" && item.status === "COMPLETED")
      .map((item) => Number(item.amount))
  ));
  const walletPurchases = roundMoney(sumNumbers(
    walletTransactions
      .filter((item) => item.type === "LABEL_PURCHASE" && item.status === "COMPLETED")
      .map((item) => Math.abs(Number(item.amount)))
  ));
  const walletRefunds = roundMoney(sumNumbers(
    walletTransactions
      .filter((item) => item.type === "VOID_REFUND" && item.status === "COMPLETED")
      .map((item) => Number(item.amount))
  ));
  const manualCredits = roundMoney(sumNumbers(
    walletTransactions
      .filter((item) => item.type === "MANUAL_CREDIT" && item.status === "COMPLETED")
      .map((item) => Number(item.amount))
  ));
  const manualDebits = roundMoney(sumNumbers(
    walletTransactions
      .filter((item) => item.type === "MANUAL_DEBIT" && item.status === "COMPLETED")
      .map((item) => Math.abs(Number(item.amount)))
  ));

  return {
    days: safeDays,
    startDate: startDate.toISOString(),
    metrics: {
      orderCount: orders.length,
      labelPurchasedCount: orders.filter((order) => order.status === "LABEL_PURCHASED" || order.status === "COMPLETED").length,
      paidWithoutLabelCount: orders.filter((order) => order.status === "PAID" && !order.labelUrl).length,
      failedOrderCount: orders.filter((order) => order.status === "FAILED").length,
      quotedRevenue,
      quotedCarrierCost,
      actualCarrierCost,
      grossMargin: roundMoney(quotedRevenue - actualCarrierCost),
      walletCollected,
      stripeCollected,
      walletLiability,
      topUps,
      walletPurchases,
      walletRefunds,
      manualCredits,
      manualDebits,
      openAdjustmentCount: openAdjustments.length,
      openAdjustmentAmount,
      walletFailureCount: walletFailures.length
    },
    openAdjustments: openAdjustments.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      customer: item.customer.companyName || item.customer.email,
      carrier: item.carrierCode,
      reason: item.reason,
      status: item.status,
      amountToCharge: Number(item.amountToCharge),
      trackingNumber: item.order.trackingNumber,
      createdAt: item.createdAt.toISOString()
    })),
    recentAdjustments: recentAdjustments.map((item) => ({
      id: item.id,
      orderId: item.order.id,
      customer: item.customer.companyName || item.customer.email,
      carrier: item.order.selectedCarrier,
      status: item.status,
      amountToCharge: Number(item.amountToCharge),
      reason: item.reason,
      trackingNumber: item.order.trackingNumber,
      createdAt: item.createdAt.toISOString()
    })),
    recentWalletTransactions: walletTransactions.slice(0, 12).map((item) => ({
      id: item.id,
      customer: item.user.companyName || item.user.email,
      type: item.type,
      status: item.status,
      amount: Number(item.amount),
      description: item.description,
      orderId: item.orderId,
      carrier: item.order?.selectedCarrier ?? null,
      createdAt: item.createdAt.toISOString()
    })),
    walletFailures: walletFailures.map((item) => ({
      id: item.id,
      customer: item.user.companyName || item.user.email,
      type: item.type,
      amount: Number(item.amount),
      description: item.description,
      orderId: item.orderId,
      createdAt: item.createdAt.toISOString()
    })),
    customersWithStoredBalance: users
      .map((user) => ({
        id: user.id,
        customer: user.companyName || user.email,
        balance: Number(user.walletBalance)
      }))
      .filter((user) => user.balance > 0)
      .sort((left, right) => right.balance - left.balance)
      .slice(0, 10),
    ordersNeedingAttention: recentOrdersNeedingAttention.map((order) => ({
      id: order.id,
      customer: order.user.companyName || order.user.email,
      status: order.status,
      carrier: order.selectedCarrier,
      service: order.selectedService,
      paymentSource: order.paymentSource,
      quotedCustomerAmount: Number(order.quotedCustomerAmount),
      labelUrl: order.labelUrl,
      trackingNumber: order.trackingNumber,
      updatedAt: order.updatedAt.toISOString()
    }))
  };
}
