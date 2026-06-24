import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { buildSubscriptionTerms, type AgreementPlan } from "@/lib/agreements/terms";
import { AgreementSign } from "@/components/agreements/agreement-sign";

/** Account-setup gate: a new customer admin signs the subscription agreement
 *  here before the dashboard unlocks. Outside the dashboard layout so the gate
 *  can't redirect-loop. */
export default async function AgreementPage() {
  const ctx = await requireCompany();
  const acting = "acting" in ctx && ctx.acting === true;
  // Founder / "managing as" is never gated, and non-admins can't sign.
  if (acting || ctx.profile?.is_platform_admin) redirect("/");
  if (ctx.current.role !== "admin") redirect("/");

  const { supabase, current } = ctx;

  // Already signed → straight in.
  const { data: existing } = await supabase
    .from("company_agreements").select("id").eq("company_id", current.company_id).limit(1);
  if (existing && existing.length > 0) redirect("/");

  const { data: company } = await supabase
    .from("companies").select("name, agreed_plan, agreed_offer").eq("id", current.company_id).single();

  const terms = buildSubscriptionTerms({
    companyName: (company?.name as string) ?? current.companies.name,
    plan: (company?.agreed_plan as AgreementPlan) ?? null,
    offer: (company?.agreed_offer as string) ?? null,
  });

  return (
    <main className="min-h-screen jcn-app-bg">
      <header className="flex h-14 items-center border-b border-white/20 bg-white/10 px-6 backdrop-blur">
        <span className="text-base font-bold text-white drop-shadow-sm">Join Care Now</span>
      </header>
      <div className="bg-white/95">
        <AgreementSign title={terms.title} bodyText={terms.bodyText} />
      </div>
    </main>
  );
}
