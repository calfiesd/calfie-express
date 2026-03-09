import { NextResponse } from "next/server";
import { registerWithPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const companyName = String(body?.companyName ?? "").trim();

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ ok: false, message: "Name, email, and an 8+ character password are required." }, { status: 400 });
  }

  const result = await registerWithPassword({
    name,
    email,
    password,
    companyName: companyName || undefined
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      companyName: result.user.companyName
    }
  });
}
