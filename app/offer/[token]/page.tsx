import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSignableDocs } from "@/modules/offers/actions";
import { OfferRespond, type TokenOffer } from "@/components/offer/offer-respond";

export default async function OfferTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_offer_by_token", { p_token: token });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) notFound();

  const documents = await loadSignableDocs(token);
  const signerDefaultName = [row.first_name, row.last_name].filter(Boolean).join(" ");

  const offer: TokenOffer = {
    token,
    status: row.status as string,
    role: (row.role as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    pay: (row.pay as string) ?? null,
    hours: (row.hours as string) ?? null,
    conditional: !!row.conditional,
    conditions: (row.conditions as string) ?? null,
    message: (row.message as string) ?? null,
    companyName: (row.company_name as string) ?? "The team",
    jobTitle: (row.job_title as string) ?? null,
    firstName: (row.first_name as string) ?? null,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
      </header>
      <div className="mx-auto max-w-xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {offer.firstName ? `Hi ${offer.firstName},` : "Your job offer"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {offer.companyName} has made you an offer{offer.jobTitle ? ` for the ${offer.jobTitle} role` : ""}.
          Please review it below and let them know your decision.
        </p>
        <OfferRespond offer={offer} documents={documents} signerDefaultName={signerDefaultName} />
      </div>
    </main>
  );
}
