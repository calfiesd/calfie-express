import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";

type ZippopotamResponse = {
  country: string;
  "country abbreviation": string;
  places: Array<{
    "place name": string;
    state: string;
    "state abbreviation"?: string;
  }>;
};

export async function GET(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ message: "Sign in to look up postal codes." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const countryCode = String(searchParams.get("countryCode") ?? "").trim().toUpperCase();
  const postalCode = String(searchParams.get("postalCode") ?? "").trim();

  if (!countryCode || !postalCode) {
    return NextResponse.json({ message: "countryCode and postalCode are required." }, { status: 400 });
  }

  const response = await fetch(`https://api.zippopotam.us/${countryCode}/${encodeURIComponent(postalCode)}`, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ message: "Postal lookup service is unavailable right now." }, { status: 502 });
  }

  if (response.status === 404) {
    return NextResponse.json({ message: "Postal code was not found for that country." }, { status: 404 });
  }

  if (!response.ok) {
    return NextResponse.json({ message: `Postal lookup failed with status ${response.status}.` }, { status: 502 });
  }

  const body = await response.json() as ZippopotamResponse;
  const firstPlace = body.places[0];

  if (!firstPlace) {
    return NextResponse.json({ message: "Postal code lookup returned no places." }, { status: 404 });
  }

  return NextResponse.json({
    location: {
      city: firstPlace["place name"],
      state: firstPlace["state abbreviation"] || firstPlace.state || "",
      stateName: firstPlace.state || firstPlace["state abbreviation"] || "",
      countryCode: body["country abbreviation"] || countryCode,
      countryName: body.country || countryCode,
      matches: body.places.length
    }
  });
}
