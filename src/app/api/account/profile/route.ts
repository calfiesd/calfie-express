import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const companyName = String(body?.companyName ?? "").trim();

  if (!name) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      companyName: companyName || null
    },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true
    }
  });

  return NextResponse.json({
    ok: true,
    profile: updated,
    message: "Profile updated."
  });
}
