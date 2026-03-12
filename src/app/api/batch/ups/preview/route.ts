import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { quoteUpsBatchRows } from "@/lib/batch/ups";
import type { UpsBatchPreviewResponse } from "@/lib/domain-types";

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user?.pricingProfile) {
    return NextResponse.json({ message: "Sign in to preview UPS batch quotes." }, { status: 401 });
  }

  if (user.pricingProfile.allowUps === false) {
    return NextResponse.json({ message: "UPS is disabled for this customer." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const csvText = typeof body?.csvText === "string" ? body.csvText : "";

  if (!csvText.trim()) {
    return NextResponse.json({ message: "Upload a UPS CSV file before previewing batch quotes." }, { status: 400 });
  }

  try {
    const quoted = await quoteUpsBatchRows({ user, csvText });
    const response = {
      rows: quoted.rows.map((row) => row.previewRow),
      totals: quoted.totals,
      note: "UPS batch preview is ready. Review every row, confirm wallet balance covers the total, then buy from prepaid funds."
    } satisfies UpsBatchPreviewResponse;

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPS batch CSV could not be parsed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
