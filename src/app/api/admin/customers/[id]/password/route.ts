import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const password = String(body?.password ?? "").trim();

  if (!password) {
    return NextResponse.json({ message: "Please enter a new password." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });
  }

  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (!customer || customer.role !== "CUSTOMER") {
    return NextResponse.json({ message: "Customer not found." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: hashPassword(password)
    }
  });

  return NextResponse.json({
    ok: true,
    message: `Reset password for ${customer.email}.`
  });
}
