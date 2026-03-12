import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getWalletSummary } from "@/lib/wallet";

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to view wallet details." }, { status: 401 });
  }

  const wallet = await getWalletSummary(user.id);

  return NextResponse.json({
    wallet,
    note: "Prepaid balance and transaction history for the signed-in customer."
  });
}
