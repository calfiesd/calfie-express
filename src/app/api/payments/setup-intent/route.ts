import { NextResponse } from "next/server";
import { createSetupIntent, getStripeStatus } from "@/lib/payments/stripe";
import { requireUser } from "@/lib/auth/session";

export async function POST() {
  const user = await requireUser();
  const status = getStripeStatus();
  const setupIntent = await createSetupIntent(user ? {
    id: user.id,
    email: user.email,
    name: user.name,
    companyName: user.companyName,
    stripeCustomerId: user.stripeCustomerId
  } : undefined);

  return NextResponse.json({
    stripe: status,
    setupIntent
  });
}