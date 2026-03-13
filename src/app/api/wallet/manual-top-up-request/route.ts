import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createManualTopUpRequest, getCustomerManualTopUpRequests } from "@/lib/manual-top-ups";
import { env } from "@/lib/config";

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const requests = await getCustomerManualTopUpRequests(user.id);
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  if (!env.MANUAL_TOP_UP_ENABLED) {
    return NextResponse.json({ message: "Manual top-up is not enabled." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  try {
    const created = await createManualTopUpRequest({
      userId: user.id,
      amount: Number(body?.amount ?? 0),
      paymentMethod: String(body?.paymentMethod ?? ""),
      reference: typeof body?.reference === "string" ? body.reference : undefined,
      note: typeof body?.note === "string" ? body.note : undefined
    });

    return NextResponse.json({
      request: created,
      message: "Manual top-up request submitted. We will review your transfer and credit the wallet manually."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual top-up request failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
