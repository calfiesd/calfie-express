import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json({ message: "Name, email, and password are required." }, { status: 400 });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return NextResponse.json({ message: "A customer with that email already exists." }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: {
      role: "CUSTOMER",
      name,
      email,
      companyName: String(body?.companyName ?? "").trim() || null,
      passwordHash: hashPassword(password),
      pricingProfile: {
        create: {
          markupPercent: toNumber(body?.markupPercent, 12),
          flatFee: toNumber(body?.flatFee, 1.5),
          minimumProfit: toNumber(body?.minimumProfit, 4),
          residentialSurcharge: toNumber(body?.residentialSurcharge, 1),
          signatureSurcharge: toNumber(body?.signatureSurcharge, 2.5),
          enabled: body?.enabled === false ? false : true
        }
      }
    },
    include: {
      pricingProfile: true,
      _count: {
        select: {
          orders: true,
          quotes: true
        }
      },
      orders: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

  return NextResponse.json({
    ok: true,
    customer: created,
    message: `Created customer ${created.email}.`
  });
}
