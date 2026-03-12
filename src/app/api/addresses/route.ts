import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSavedAddress, getSavedAddresses } from "@/lib/addresses";

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to view saved addresses." }, { status: 401 });
  }

  const addresses = await getSavedAddresses(user.id);
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to save addresses." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const address = await createSavedAddress(user.id, {
      label: body?.label,
      name: body?.name,
      company: body?.company,
      phone: body?.phone,
      email: body?.email,
      line1: body?.line1,
      line2: body?.line2,
      city: body?.city,
      state: body?.state,
      postalCode: body?.postalCode,
      countryCode: body?.countryCode,
      isDefault: body?.isDefault === true
    });

    return NextResponse.json({ address, message: `Saved address ${address.label}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saved address could not be created.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
