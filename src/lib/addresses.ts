import { prisma } from "@/lib/db";
import type { SavedAddressSummary } from "@/lib/domain-types";

type SavedAddressInput = {
  label: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode?: string | null;
  isDefault?: boolean;
};

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeRequired(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
}

function mapSavedAddress(address: {
  id: string;
  label: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: Date;
}): SavedAddressSummary {
  return {
    id: address.id,
    label: address.label,
    name: address.name,
    company: address.company,
    phone: address.phone,
    email: address.email,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString()
  };
}

function parseSavedAddress(input: SavedAddressInput) {
  return {
    label: normalizeRequired(input.label, "Label"),
    name: normalizeRequired(input.name, "Recipient name"),
    company: normalizeText(input.company),
    phone: normalizeText(input.phone),
    email: normalizeText(input.email),
    line1: normalizeRequired(input.line1, "Address line 1"),
    line2: normalizeText(input.line2),
    city: normalizeRequired(input.city, "City"),
    state: normalizeRequired(input.state, "State"),
    postalCode: normalizeRequired(input.postalCode, "Postal code"),
    countryCode: normalizeRequired(input.countryCode ?? "US", "Country code").toUpperCase(),
    isDefault: input.isDefault === true
  };
}

export async function getSavedAddresses(userId: string) {
  const addresses = await prisma.savedAddress.findMany({
    where: { userId },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" }
    ]
  });

  return addresses.map(mapSavedAddress);
}

export async function createSavedAddress(userId: string, input: SavedAddressInput) {
  const parsed = parseSavedAddress(input);

  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.savedAddress.count({ where: { userId } });
    const shouldBeDefault = parsed.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await tx.savedAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const created = await tx.savedAddress.create({
      data: {
        userId,
        label: parsed.label,
        name: parsed.name,
        company: parsed.company,
        phone: parsed.phone,
        email: parsed.email,
        line1: parsed.line1,
        line2: parsed.line2,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        countryCode: parsed.countryCode,
        isDefault: shouldBeDefault
      }
    });

    return mapSavedAddress(created);
  });
}

export async function updateSavedAddress(userId: string, addressId: string, input: SavedAddressInput) {
  const parsed = parseSavedAddress(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.savedAddress.findFirst({
      where: { id: addressId, userId }
    });

    if (!existing) {
      throw new Error("Saved address was not found.");
    }

    if (parsed.isDefault) {
      await tx.savedAddress.updateMany({
        where: { userId, id: { not: addressId }, isDefault: true },
        data: { isDefault: false }
      });
    }

    const updated = await tx.savedAddress.update({
      where: { id: addressId },
      data: {
        label: parsed.label,
        name: parsed.name,
        company: parsed.company,
        phone: parsed.phone,
        email: parsed.email,
        line1: parsed.line1,
        line2: parsed.line2,
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        countryCode: parsed.countryCode,
        isDefault: parsed.isDefault
      }
    });

    if (!parsed.isDefault) {
      const defaultCount = await tx.savedAddress.count({
        where: { userId, isDefault: true }
      });

      if (defaultCount === 0) {
        await tx.savedAddress.update({
          where: { id: updated.id },
          data: { isDefault: true }
        });
        updated.isDefault = true;
      }
    }

    return mapSavedAddress(updated);
  });
}

export async function deleteSavedAddress(userId: string, addressId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.savedAddress.findFirst({
      where: { id: addressId, userId }
    });

    if (!existing) {
      throw new Error("Saved address was not found.");
    }

    await tx.savedAddress.delete({ where: { id: addressId } });

    if (existing.isDefault) {
      const replacement = await tx.savedAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });

      if (replacement) {
        await tx.savedAddress.update({
          where: { id: replacement.id },
          data: { isDefault: true }
        });
      }
    }
  });
}
