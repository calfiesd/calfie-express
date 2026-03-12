import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { executeUpsBatchPurchase } from "@/lib/batch-purchase";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to buy a UPS batch." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === "string" ? body.csvText : "";

  if (!csvText.trim()) {
    return NextResponse.json({ message: "Upload the UPS CSV file before buying labels." }, { status: 400 });
  }

  try {
    const result = await executeUpsBatchPurchase({ user, csvText });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPS batch purchase failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
