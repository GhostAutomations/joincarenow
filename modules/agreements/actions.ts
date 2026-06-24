"use server";

import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { buildSubscriptionTerms, type AgreementPlan } from "@/lib/agreements/terms";

export type AgreementState = { error?: string } | undefined;

/** Record the customer's acceptance of the subscription agreement (type name +
 *  tick). Only a real company admin can sign; the founder "managing as" a
 *  company is never gated and does not sign on the customer's behalf. */
export async function signAgreement(_prev: AgreementState, formData: FormData): Promise<AgreementState> {
  const ctx = await requireCompany();
  const acting = "acting" in ctx && ctx.acting === true;
  if (acting || ctx.profile?.is_platform_admin) redirect("/");
  if (ctx.current.role !== "admin") return { error: "Only a company admin can accept the agreement." };

  const name = (formData.get("signer_name")?.toString() ?? "").trim();
  const agreed = formData.get("agree") === "on" || formData.get("agree") === "true";
  if (name.length < 2) return { error: "Please type your full name." };
  if (!agreed) return { error: "Please tick the box to confirm you agree to the terms." };

  const { supabase, current, user, profile } = ctx;

  // Already signed? Don't double-record — just let them in.
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

  const { error } = await supabase.from("company_agreements").insert({
    company_id: current.company_id,
    version: terms.version,
    plan: (company?.agreed_plan as string) ?? null,
    offer: (company?.agreed_offer as string) ?? null,
    terms_snapshot: terms.bodyText,
    signer_user_id: user.id,
    signer_name: name,
    signer_email: profile?.email ?? null,
  });
  if (error) return { error: "Could not record your acceptance. Please try again." };

  redirect("/");
}
