import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { deleteSavedAddress, updateSavedAddress } from "@/lib/addresses";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to update saved addresses." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  try {
    const address = await updateSavedAddress(user.id, id, {
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

    return NextResponse.json({ address, message: `Updated address ${address.label}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saved address could not be updated.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to delete saved addresses." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteSavedAddress(user.id, id);
    return NextResponse.json({ ok: true, message: "Saved address deleted." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saved address could not be deleted.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
