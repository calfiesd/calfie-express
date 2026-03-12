import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getCustomerCarrierAdjustments } from "@/lib/adjustments";

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const adjustments = await getCustomerCarrierAdjustments(user.id);
  return NextResponse.json({
    ok: true,
    adjustments
  });
}
