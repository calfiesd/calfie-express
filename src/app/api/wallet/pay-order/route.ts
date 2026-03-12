import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { payOrderWithWallet, getWalletSummary } from "@/lib/wallet";
import { fulfillOrderFromWallet } from "@/lib/orders/fulfillment";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to pay from wallet." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId = String(body?.orderId ?? body?.order?.id ?? "");

  if (!orderId) {
    return NextResponse.json({ message: "Order ID is required." }, { status: 400 });
  }

  try {
    const payment = await payOrderWithWallet({
      orderId,
      userId: user.id
    });

    const result = await fulfillOrderFromWallet({
      orderId: payment.orderId
    });
    const wallet = await getWalletSummary(user.id);

    return NextResponse.json({
      ok: true,
      wallet,
      walletPayment: payment,
      purchased: result.purchased,
      note: payment.alreadyPaid ? "Order was already funded from wallet." : result.note,
      diagnostic: result.diagnostic,
      orderId: result.orderId ?? payment.orderId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet payment failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
