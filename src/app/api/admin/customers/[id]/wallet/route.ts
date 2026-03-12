import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { applyAdminWalletAdjustment, getWalletSummary } from "@/lib/wallet";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true
    }
  });

  if (!customer || customer.role !== "CUSTOMER") {
    return NextResponse.json({ message: "Customer not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount ?? 0);
  const note = String(body?.note ?? "");

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ message: "Adjustment amount must be a non-zero number." }, { status: 400 });
  }

  try {
    const adjustment = await applyAdminWalletAdjustment({
      userId: id,
      amount,
      note,
      adminEmail: admin.email
    });
    const wallet = await getWalletSummary(id);

    return NextResponse.json({
      ok: true,
      wallet,
      adjustment,
      message: amount > 0
        ? `Credited ${adjustment.userEmail} wallet by $${amount.toFixed(2)}.`
        : `Debited ${adjustment.userEmail} wallet by $${Math.abs(amount).toFixed(2)}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet adjustment failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
