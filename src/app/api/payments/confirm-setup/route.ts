import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getDefaultPaymentMethodSummary, retrieveSetupIntent } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const setupIntentId = String(body?.setupIntentId ?? "").trim();

  if (!setupIntentId) {
    return NextResponse.json({ message: "Setup intent ID is required." }, { status: 400 });
  }

  const result = await retrieveSetupIntent(setupIntentId);

  if (result.status !== "succeeded" || !result.paymentMethodId) {
    return NextResponse.json({ message: "Payment method setup has not completed yet." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: result.customerId ?? user.stripeCustomerId,
      defaultPaymentMethod: result.paymentMethodId
    },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      stripeCustomerId: true,
      defaultPaymentMethod: true
    }
  });

  const paymentMethod = await getDefaultPaymentMethodSummary(updated);

  return NextResponse.json({
    ok: true,
    paymentMethod,
    note: "Default payment method saved for future wallet funding and carrier adjustment billing."
  });
}
