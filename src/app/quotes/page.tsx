export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { CustomerQuotesTable } from "@/components/quotes/customer-quotes-table";
import { requireUser } from "@/lib/auth/session";
import { getStoredQuotes } from "@/lib/quotes";

function extractRatesCount(ratesJson: unknown) {
  return Array.isArray(ratesJson) ? ratesJson.length : 0;
}

export default async function QuotesPage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const quotes = await getStoredQuotes(user.id);
  const rows = quotes.map((quote) => ({
    id: quote.id,
    status: quote.status,
    shipFromPostalCode: quote.shipFromPostalCode,
    shipToPostalCode: quote.shipToPostalCode,
    packageWeight: Number(quote.packageWeight),
    createdAt: quote.createdAt.toISOString(),
    ratesCount: extractRatesCount(quote.ratesJson)
  }));

  return (
    <>
      <SiteNav />
      <section className="section card">
        <p className="eyebrow">Quote history</p>
        <h1>Saved carrier quote runs</h1>
        <p className="muted">
          Review prior rating requests and load a stored quote back into the dashboard when you want to reuse a shipment lane.
        </p>
      </section>

      <CustomerQuotesTable quotes={rows} />
    </>
  );
}
