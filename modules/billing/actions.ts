"use server";

import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomer, createCheckoutSession, createPortalSession, BASE_URL } from "@/lib/billing/stripe";
import { parseConcession } from "@/lib/billing/concession";

type AgreedPlan = "monthly" | "commit" | "annual";
function planToCheckout(plan: AgreedPlan | null): { interval: "month" | "year"; commit: boolean } {
  if (plan === "annual") return { interval: "year", commit: false };
  if (plan === "commit") return { interval: "month", commit: true };
  return { interval: "month", commit: false }; // monthly (default)
}

/** New customer pays to activate: starts Checkout for the plan they were sold,
 *  with any agreed concession applied (free months, custom price, SMS bonus). */
export async function startActivationCheckout(): Promise<void> {
  const { current, profile } = await requireCompany();
  if (current.role !== "admin") return;

  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("name, stripe_customer_id, agreed_plan, agreed_offer")
    .eq("id", current.company_id)
    .single();

  const customerId = await ensureCustomer({
    existingId: (company?.stripe_customer_id as string) ?? null,
    companyId: current.company_id,
    name: (company?.name as string) ?? "Care company",
    email: profile?.email ?? null,
  });

  const concession = parseConcession(company?.agreed_offer as string | null);
  const update: Record<string, unknown> = {};
  if (customerId !== company?.stripe_customer_id) update.stripe_customer_id = customerId;
  if (concession?.extraSms) update.sms_bonus = concession.extraSms;
  if (Object.keys(update).length) await db.from("companies").update(update).eq("id", current.company_id);

  const { interval, commit } = planToCheckout((company?.agreed_plan as AgreedPlan) ?? null);
  const url = await createCheckoutSession({
    customerId,
    companyId: current.company_id,
    interval,
    commit,
    concession: concession
      ? { freeMonths: concession.freeMonths, customMonthlyPence: concession.customMonthlyPence }
      : null,
    successUrl: `${BASE_URL}/activate?status=success`,
    cancelUrl: `${BASE_URL}/activate?status=cancelled`,
  });
  redirect(url);
}

/** Company admin starts a subscription checkout (monthly or annual). */
export async function startCheckout(formData: FormData): Promise<void> {
  const { current, profile } = await requireCompany();
  if (current.role !== "admin") return;
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const commit = formData.get("commit") === "true";

  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("name, stripe_customer_id")
    .eq("id", current.company_id)
    .single();

  const customerId = await ensureCustomer({
    existingId: (company?.stripe_customer_id as string) ?? null,
    companyId: current.company_id,
    name: (company?.name as string) ?? "Care company",
    email: profile?.email ?? null,
  });
  if (customerId !== company?.stripe_customer_id) {
    await db.from("companies").update({ stripe_customer_id: customerId }).eq("id", current.company_id);
  }

  const url = await createCheckoutSession({ customerId, companyId: current.company_id, interval, commit });
  redirect(url);
}

/** Company admin opens the Stripe Customer Portal to manage their subscription. */
export async function openBillingPortal(): Promise<void> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return;
  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("stripe_customer_id, commitment_until, billing_interval")
    .eq("id", current.company_id)
    .single();
  const customerId = company?.stripe_customer_id as string | null;
  if (!customerId) return;
  const committed = company?.commitment_until
    ? new Date(company.commitment_until as string) > new Date()
    : false;
  // Annual plans are paid a year up front, so they're locked in too.
  const locked = committed || company?.billing_interval === "year";
  const url = await createPortalSession(customerId, locked);
  redirect(url);
}
