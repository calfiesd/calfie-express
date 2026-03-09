import { NextResponse } from "next/server";
import { createAdjustmentCharge } from "@/lib/payments/stripe";

export async function POST() {
  const result = await createAdjustmentCharge({
    customerId: "cust_demo_001",
    amount: 6.45,
    reason: "Carrier billed higher dimensional weight"
  });

  return NextResponse.json({
    result,
    note: "Connect this route to real carrier adjustment ingestion and saved-payment-method billing."
  });
}
