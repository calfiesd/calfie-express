import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createUpsBatchFingerprint, quoteUpsBatchRows } from "@/lib/batch/ups";
import { fulfillOrderFromWallet } from "@/lib/orders/fulfillment";
import { refundWalletOrder } from "@/lib/wallet";
import type { CarrierRate, UpsBatchPreviewResponse } from "@/lib/domain-types";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof requireUser>>>;
type PurchaseUser = AuthenticatedUser;

export async function executeUpsBatchPurchase(args: {
  user: PurchaseUser;
  csvText: string;
  ignoreDuplicateBatchId?: string;
  retryOfBatchId?: string;
}) {
  if (!args.user.pricingProfile) {
    return {
      status: 403,
      body: { message: "UPS purchase requires an active pricing profile." }
    } as const;
  }

  if (args.user.pricingProfile.allowUps === false || args.user.pricingProfile.allowUpsPurchase === false) {
    return {
      status: 403,
      body: { message: "UPS purchase is disabled for this customer." }
    } as const;
  }

  const fingerprint = createUpsBatchFingerprint(args.user.id, args.csvText);
  const duplicate = await prisma.batchPurchase.findFirst({
    where: {
      userId: args.user.id,
      fingerprint,
      ...(args.ignoreDuplicateBatchId ? { id: { not: args.ignoreDuplicateBatchId } } : {})
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (duplicate) {
    return {
      status: 409,
      body: {
        message: "This exact UPS batch file was already processed for this customer. Re-export or change the file before buying again.",
        duplicateBatchId: duplicate.id
      }
    } as const;
  }

  const quoted = await quoteUpsBatchRows({ user: args.user, csvText: args.csvText });
  const errorRows = quoted.rows.filter((row) => row.previewRow.status === "error");

  if (errorRows.length > 0) {
    return {
      status: 400,
      body: {
        rows: quoted.rows.map((row) => row.previewRow),
        totals: quoted.totals,
        note: "Fix every batch row error before buying labels from wallet."
      } satisfies UpsBatchPreviewResponse
    } as const;
  }

  const freshUser = await prisma.user.findUnique({
    where: { id: args.user.id },
    select: { walletBalance: true }
  });

  const totalRequired = roundMoney(quoted.totals.customerPriceTotal);
  const availableBalance = Number(freshUser?.walletBalance ?? 0);

  if (availableBalance < totalRequired) {
    return {
      status: 400,
      body: {
        rows: quoted.rows.map((row) => row.previewRow),
        totals: quoted.totals,
        note: `Wallet balance ${availableBalance.toFixed(2)} is below the batch total ${totalRequired.toFixed(2)}.`
      } satisfies UpsBatchPreviewResponse
    } as const;
  }

  let runningBalance = availableBalance;
  const purchaseRows = [] as UpsBatchPreviewResponse["rows"];

  for (const row of quoted.quotedRows) {
    const rate = row.matchedRate as CarrierRate;
    const amount = roundMoney(rate.customerPrice);
    const margin = roundMoney(rate.customerPrice - rate.carrierCost);
    const orderResult = await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: args.user.id },
        select: { walletBalance: true }
      });

      const currentBalance = Number(currentUser?.walletBalance ?? 0);
      if (currentBalance < amount) {
        throw new Error(`Wallet balance became too low while processing row ${row.parsedRow.rowNumber}.`);
      }

      const quote = await tx.quote.create({
        data: {
          userId: args.user.id,
          status: "PRICED",
          shipFromPostalCode: row.parsedRow.shipment.shipFrom.postalCode,
          shipToPostalCode: row.parsedRow.shipment.shipTo.postalCode,
          shipDate: row.parsedRow.shipment.shipDate ? new Date(row.parsedRow.shipment.shipDate) : undefined,
          packageLength: row.parsedRow.shipment.packageLength,
          packageWidth: row.parsedRow.shipment.packageWidth,
          packageHeight: row.parsedRow.shipment.packageHeight,
          packageWeight: row.parsedRow.shipment.packageWeight,
          declaredValue: row.parsedRow.shipment.declaredValue,
          residential: row.parsedRow.shipment.residential,
          signatureRequired: row.parsedRow.shipment.signatureRequired,
          shipmentJson: row.parsedRow.shipment,
          ratesJson: [rate]
        }
      });

      const order = await tx.order.create({
        data: {
          userId: args.user.id,
          quoteId: quote.id,
          status: "PAID",
          paymentSource: "WALLET",
          selectedCarrier: rate.carrier,
          selectedService: rate.serviceCode,
          quotedCustomerAmount: rate.customerPrice,
          quotedCarrierAmount: rate.carrierCost,
          marginAmount: margin,
          walletDebitedAmount: amount,
          shipmentJson: row.parsedRow.shipment,
          selectedRateJson: rate
        }
      });

      const balanceAfter = roundMoney(currentBalance - amount);

      await tx.walletTransaction.create({
        data: {
          userId: args.user.id,
          orderId: order.id,
          type: "LABEL_PURCHASE",
          status: "COMPLETED",
          amount: -amount,
          balanceBefore: currentBalance,
          balanceAfter,
          description: `Wallet payment for batch order ${order.id}`,
          metadataJson: {
            batchMode: "ups_csv",
            rowNumber: row.parsedRow.rowNumber,
            reference1: row.parsedRow.reference1 ?? null,
            requestedServiceCode: row.parsedRow.requestedServiceCode,
            batchFingerprint: fingerprint,
            retryOfBatchId: args.retryOfBatchId ?? null
          }
        }
      });

      await tx.user.update({
        where: { id: args.user.id },
        data: { walletBalance: balanceAfter }
      });

      return { orderId: order.id, balanceAfter };
    });

    runningBalance = orderResult.balanceAfter;
    const fulfillment = await fulfillOrderFromWallet({ orderId: orderResult.orderId });

    if (fulfillment.purchased) {
      purchaseRows.push({
        ...row.previewRow,
        status: "purchased",
        orderId: orderResult.orderId,
        trackingNumber: fulfillment.purchased.trackingNumber,
        labelUrl: fulfillment.purchased.labelUrl,
        message: fulfillment.note
      });
      continue;
    }

    await refundWalletOrder({ orderId: orderResult.orderId });
    await prisma.order.update({
      where: { id: orderResult.orderId },
      data: { status: "FAILED" }
    }).catch(() => null);

    const refreshedBalance = await prisma.user.findUnique({
      where: { id: args.user.id },
      select: { walletBalance: true }
    });
    runningBalance = Number(refreshedBalance?.walletBalance ?? runningBalance);

    purchaseRows.push({
      ...row.previewRow,
      status: "failed",
      orderId: orderResult.orderId,
      message: fulfillment.diagnostic ? `${fulfillment.diagnostic} Wallet charge was returned.` : "Label purchase failed and wallet charge was returned."
    });
  }

  const purchasedCount = purchaseRows.filter((row) => row.status === "purchased").length;
  const failedCount = purchaseRows.filter((row) => row.status === "failed").length;
  const response = {
    rows: purchaseRows,
    totals: {
      ...quoted.totals,
      purchasedCount,
      failedCount
    },
    note:
      failedCount > 0
        ? `Batch processed with ${purchasedCount} purchased and ${failedCount} failed rows. Failed rows were refunded to wallet.`
        : `Batch purchase complete. ${purchasedCount} UPS labels were bought from wallet. Remaining balance ${runningBalance.toFixed(2)}.`
  } satisfies UpsBatchPreviewResponse;

  const batch = await prisma.batchPurchase.create({
    data: {
      userId: args.user.id,
      fingerprint,
      rowCount: response.totals.rowCount,
      totalAmount: totalRequired,
      status: failedCount > 0 ? "FAILED" : "COMPLETED",
      sourceCsv: args.csvText,
      retryOfBatchId: args.retryOfBatchId ?? null,
      resultJson: response
    }
  });

  return {
    status: 200,
    body: {
      ...response,
      batchId: batch.id
    }
  } as const;
}








