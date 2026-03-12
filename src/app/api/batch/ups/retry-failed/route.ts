import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { executeUpsBatchPurchase } from "@/lib/batch-purchase";
import type { UpsBatchPreviewResponse } from "@/lib/domain-types";

function extractRetryCsv(sourceCsv: string, failedRows: number[]) {
  const lines = sourceCsv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return failedRows
    .map((rowNumber) => lines[rowNumber - 1])
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to retry failed UPS batch rows." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const batchId = String(body?.batchId ?? "");

  if (!batchId) {
    return NextResponse.json({ message: "Batch ID is required." }, { status: 400 });
  }

  const batch = await prisma.batchPurchase.findFirst({
    where: {
      id: batchId,
      userId: user.id
    }
  });

  if (!batch) {
    return NextResponse.json({ message: "Stored batch not found." }, { status: 404 });
  }

  if (!batch.sourceCsv) {
    return NextResponse.json({ message: "This batch was stored before retry support was added and cannot be retried automatically." }, { status: 400 });
  }

  const result = (batch.resultJson ?? null) as UpsBatchPreviewResponse | null;
  const failedRows = result?.rows
    ?.filter((row) => row.status === "failed")
    .map((row) => row.rowNumber) ?? [];

  if (!failedRows.length) {
    return NextResponse.json({ message: "This batch has no failed rows to retry." }, { status: 400 });
  }

  const retryCsv = extractRetryCsv(batch.sourceCsv, failedRows);
  if (!retryCsv.trim()) {
    return NextResponse.json({ message: "Failed rows could not be reconstructed for retry." }, { status: 400 });
  }

  try {
    const purchase = await executeUpsBatchPurchase({
      user,
      csvText: retryCsv,
      ignoreDuplicateBatchId: batch.id,
      retryOfBatchId: batch.id
    });

    return NextResponse.json(purchase.body, { status: purchase.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed-row retry failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
