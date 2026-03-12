import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { updateCarrierAdjustmentStatus } from "@/lib/adjustments";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const adjustment = await updateCarrierAdjustmentStatus(id, "WAIVED");
    return NextResponse.json({
      ok: true,
      adjustment,
      message: `Waived adjustment ${adjustment.id}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update adjustment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
