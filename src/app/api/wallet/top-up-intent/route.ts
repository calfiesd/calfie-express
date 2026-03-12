import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createWalletTopUpDraft } from "@/lib/wallet";

function normalizeAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : NaN;
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to add wallet funds." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amount = normalizeAmount(body?.amount);

  if (!(amount >= 1)) {
    return NextResponse.json({ message: "Wallet top-up amount must be at least $1.00." }, { status: 400 });
  }

  const checkout = await createWalletTopUpDraft({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      companyName: user.companyName,
      stripeCustomerId: user.stripeCustomerId
    },
    amount
  });

  return NextResponse.json({
    checkout,
    note: "Wallet funding draft created. Confirm payment to add prepaid balance."
  });
}
