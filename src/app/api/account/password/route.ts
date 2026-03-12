import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: "Current and new password are required." }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ message: "New password must be at least 8 characters." }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      passwordHash: true
    }
  });

  if (!currentUser || !verifyPassword(currentPassword, currentUser.passwordHash)) {
    return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword)
    }
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated."
  });
}
