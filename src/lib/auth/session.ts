import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const AUTH_COOKIE = "calfie_session";

export async function getSessionUser() {
  const store = await cookies();
  const session = store.get(AUTH_COOKIE)?.value;

  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: session },
    include: { pricingProfile: true }
  });
}

export async function requireUser() {
  return getSessionUser();
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { pricingProfile: true }
  });

  if (!user) {
    return { ok: false as const, message: "Unknown customer email." };
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, message: "Incorrect password." };
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, normalizedEmail, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return { ok: true as const, user };
}

export async function registerWithPassword(args: {
  name: string;
  email: string;
  password: string;
  companyName?: string;
}) {
  const normalizedEmail = args.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return { ok: false as const, message: "An account with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      name: args.name.trim(),
      email: normalizedEmail,
      companyName: args.companyName?.trim() || null,
      passwordHash: hashPassword(args.password),
      pricingProfile: {
        create: {
          markupPercent: 12,
          flatFee: 1.5,
          minimumProfit: 4,
          residentialSurcharge: 1,
          signatureSurcharge: 2.5
        }
      }
    },
    include: { pricingProfile: true }
  });

  const store = await cookies();
  store.set(AUTH_COOKIE, user.email, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return { ok: true as const, user };
}

export async function signOut() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  return { ok: true as const };
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return user;
}
