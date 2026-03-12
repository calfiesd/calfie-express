import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const customer = await prisma.user.findUnique({
    where: { id },
    include: { pricingProfile: true }
  });

  if (!customer || customer.role !== "CUSTOMER") {
    return NextResponse.json({ message: "Customer not found." }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: String(body?.name ?? customer.name).trim() || customer.name,
      companyName: String(body?.companyName ?? customer.companyName ?? "").trim() || null,
      pricingProfile: {
        upsert: {
          create: {
            markupPercent: toNumber(body?.markupPercent, 12),
            flatFee: toNumber(body?.flatFee, 0),
            minimumProfit: toNumber(body?.minimumProfit, 0),
            residentialSurcharge: toNumber(body?.residentialSurcharge, 0),
            signatureSurcharge: toNumber(body?.signatureSurcharge, 0),
            enabled: Boolean(body?.enabled ?? true),
            allowUps: body?.allowUps === false ? false : true,
            allowFedex: body?.allowFedex === false ? false : true,
            allowUpsPurchase: body?.allowUpsPurchase === false ? false : true,
            allowFedexPurchase: body?.allowFedexPurchase === false ? false : true
          },
          update: {
            markupPercent: toNumber(body?.markupPercent, Number(customer.pricingProfile?.markupPercent ?? 12)),
            flatFee: toNumber(body?.flatFee, Number(customer.pricingProfile?.flatFee ?? 0)),
            minimumProfit: toNumber(body?.minimumProfit, Number(customer.pricingProfile?.minimumProfit ?? 0)),
            residentialSurcharge: toNumber(body?.residentialSurcharge, Number(customer.pricingProfile?.residentialSurcharge ?? 0)),
            signatureSurcharge: toNumber(body?.signatureSurcharge, Number(customer.pricingProfile?.signatureSurcharge ?? 0)),
            enabled: Boolean(body?.enabled ?? customer.pricingProfile?.enabled ?? true),
            allowUps: body?.allowUps === false ? false : Boolean(customer.pricingProfile?.allowUps ?? true),
            allowFedex: body?.allowFedex === false ? false : Boolean(customer.pricingProfile?.allowFedex ?? true),
            allowUpsPurchase: body?.allowUpsPurchase === false ? false : Boolean(customer.pricingProfile?.allowUpsPurchase ?? true),
            allowFedexPurchase: body?.allowFedexPurchase === false ? false : Boolean(customer.pricingProfile?.allowFedexPurchase ?? true)
          }
        }
      }
    },
    include: {
      pricingProfile: true,
      walletTransactions: {
        orderBy: {
          createdAt: "desc"
        },
        take: 8,
        include: {
          order: {
            select: {
              id: true,
              selectedCarrier: true,
              selectedService: true,
              status: true
            }
          }
        }
      },
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
    customer: updated,
    message: `Updated pricing profile for ${updated.email}.`
  });
}
