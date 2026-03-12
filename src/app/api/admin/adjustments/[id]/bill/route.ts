import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { billCarrierAdjustment } from "@/lib/adjustments";

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
    const result = await billCarrierAdjustment(id);
    return NextResponse.json({
      ok: true,
      adjustment: result.adjustment,
      billing: result.billing,
      message: `Billed adjustment ${result.adjustment.id}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to bill adjustment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
