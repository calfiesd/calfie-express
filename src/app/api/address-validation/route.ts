import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/config";
import { getUpsAccessToken, requestUpsAddressValidation } from "@/lib/ups/client";
import type { ValidatableAddress } from "@/lib/domain-types";

function normalizeAddress(body: unknown): ValidatableAddress {
  const source = (body ?? {}) as Record<string, unknown>;

  return {
    name: String(source.name ?? "").trim() || undefined,
    company: String(source.company ?? "").trim() || undefined,
    line1: String(source.line1 ?? "").trim(),
    line2: String(source.line2 ?? "").trim() || undefined,
    city: String(source.city ?? "").trim(),
    state: String(source.state ?? "").trim().toUpperCase(),
    postalCode: String(source.postalCode ?? "").trim(),
    countryCode: String(source.countryCode ?? "US").trim().toUpperCase()
  };
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to validate addresses." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const address = normalizeAddress(body?.address);

  if (!address.line1 || !address.city || !address.state || !address.postalCode || !address.countryCode) {
    return NextResponse.json({ message: "Line 1, city, state, postal code, and country code are required." }, { status: 400 });
  }

  if (!env.UPS_CLIENT_ID || !env.UPS_CLIENT_SECRET) {
    return NextResponse.json({
      validation: {
        mode: "fallback",
        requestOption: 3,
        status: "error",
        classification: undefined,
        alerts: ["UPS credentials are not configured for address validation."],
        candidateCount: 0,
        candidates: [],
        diagnostic: "UPS credentials are missing."
      }
    });
  }

  try {
    const accessToken = await getUpsAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        validation: {
          mode: "fallback",
          requestOption: 3,
          status: "error",
          classification: undefined,
          alerts: ["UPS OAuth did not return an access token."],
          candidateCount: 0,
          candidates: [],
          diagnostic: "UPS OAuth did not return an access token."
        }
      });
    }

    const validation = await requestUpsAddressValidation(accessToken, address, 3);
    return NextResponse.json({ validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address validation failed.";
    return NextResponse.json({
      validation: {
        mode: "fallback",
        requestOption: 3,
        status: "error",
        classification: undefined,
        alerts: [message],
        candidateCount: 0,
        candidates: [],
        diagnostic: message
      }
    });
  }
}
