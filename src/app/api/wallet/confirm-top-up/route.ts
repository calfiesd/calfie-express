import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { creditWalletFromPaymentIntent, getWalletSummary } from "@/lib/wallet";

function normalizeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : undefined;
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to confirm a wallet top-up." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const paymentIntentId = String(body?.paymentIntentId ?? "");

  if (!paymentIntentId) {
    return NextResponse.json({ message: "Payment intent ID is required." }, { status: 400 });
  }

  try {
    const result = await creditWalletFromPaymentIntent({
      paymentIntentId,
      userId: user.id,
      fallbackAmount: normalizeAmount(body?.amount)
    });
    const wallet = await getWalletSummary(user.id);

    return NextResponse.json({
      ok: true,
      credited: result.created,
      transactionId: result.transactionId,
      wallet,
      note: result.created ? "Wallet funded successfully." : "Wallet top-up was already applied."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet top-up confirmation failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
