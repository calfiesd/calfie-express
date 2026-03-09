import { NextResponse } from "next/server";
import { signInWithPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  const result = await signInWithPassword(email, password);

  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: { email: result.user.email, name: result.user.name } });
}