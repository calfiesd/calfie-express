import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createCarrierAdjustment, getAdminCarrierAdjustments } from "@/lib/adjustments";

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const adjustments = await getAdminCarrierAdjustments();
  return NextResponse.json({ ok: true, adjustments });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  try {
    const adjustment = await createCarrierAdjustment({
      orderId: String(body?.orderId ?? ""),
      reason: String(body?.reason ?? ""),
      carrierBilledAmount: Number(body?.carrierBilledAmount ?? 0),
      originalQuotedAmount: body?.originalQuotedAmount == null ? undefined : Number(body.originalQuotedAmount),
      amountToCharge:
        body?.amountToCharge == null || body?.amountToCharge === ""
          ? undefined
          : Number(body.amountToCharge)
    });

    return NextResponse.json({
      ok: true,
      adjustment,
      message: `Created adjustment ${adjustment.id}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create adjustment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
