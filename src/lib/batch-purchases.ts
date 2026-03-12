import { prisma } from "@/lib/db";
import type { UpsBatchPreviewResponse } from "@/lib/domain-types";

export async function getBatchPurchasesForUser(userId: string) {
  const rows = await prisma.batchPurchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60
  });

  return rows.map((row) => {
    const result = (row.resultJson ?? null) as UpsBatchPreviewResponse | null;
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      rowCount: row.rowCount,
      totalAmount: Number(row.totalAmount),
      status: row.status,
      sourceCsvPresent: Boolean(row.sourceCsv),
      retryOfBatchId: row.retryOfBatchId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      result
    };
  });
}

export async function getAllBatchPurchases() {
  const rows = await prisma.batchPurchase.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          companyName: true
        }
      }
    }
  });

  return rows.map((row) => {
    const result = (row.resultJson ?? null) as UpsBatchPreviewResponse | null;
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      rowCount: row.rowCount,
      totalAmount: Number(row.totalAmount),
      status: row.status,
      sourceCsvPresent: Boolean(row.sourceCsv),
      retryOfBatchId: row.retryOfBatchId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      result,
      user: row.user
    };
  });
}
