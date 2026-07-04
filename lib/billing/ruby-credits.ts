import { createAdminClient } from "@/lib/supabase/admin";
import { reportMeterEvent } from "@/lib/billing/stripe";

/** Ruby applicants included per calendar month on Tier 2. Beyond this, each new
 *  applicant meters at the Ruby overage price (75p). */
export const RUBY_INCLUDED_PER_MONTH = 40;

/** Stripe meter event name for Ruby applicant overage (create the meter with
 *  this event name in Stripe). Overridable via env. */
const RUBY_METER_EVENT = process.env.STRIPE_RUBY_METER_EVENT ?? "ruby_applicant";

/** First moment of the current UTC calendar month. */
function monthStartISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Record that Ruby has screened an applicant, and meter it if the company is
 * over its allowance for THIS calendar month.
 *
 * Idempotent per applicant: UNIQUE(application_id) means an applicant only ever
 * consumes ONE credit, however many times Ruby runs, re-runs or refreshes for
 * them. This is Ruby's ONLY charge — Ruby's internal AI calls do NOT trip the
 * generic 10p AI meter.
 *
 * The included allowance (40) is enforced HERE, per calendar month, so it resets
 * on the 1st for every company regardless of billing interval (monthly OR
 * annual). The Stripe Ruby Price must therefore be a FLAT 75p per unit (no
 * graduated tiers) — we only report the applicants beyond the free 40.
 *
 * Best-effort: never throws, so metering can't break a Ruby run.
 */
export async function recordRubyApplicant(
  companyId: string | null | undefined,
  applicationId: string | null | undefined
): Promise<void> {
  if (!companyId || !applicationId) return;
  try {
    const db = createAdminClient();

    // Claim the credit. On a duplicate (applicant already credited) the insert
    // errors on the unique constraint and we stop — no second report.
    const { data: inserted, error } = await db
      .from("ruby_applicant_credits")
      .insert({ company_id: companyId, application_id: applicationId })
      .select("id")
      .maybeSingle();
    if (error || !inserted) return;

    // Count credits used THIS calendar month (includes the one just claimed).
    const { count } = await db
      .from("ruby_applicant_credits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("consumed_at", monthStartISO());
    if ((count ?? 0) <= RUBY_INCLUDED_PER_MONTH) return; // within the free 40 this month

    // Beyond the monthly allowance → report one 75p unit (flat Stripe price).
    if (!process.env.STRIPE_SECRET_KEY) return;
    const { data: co } = await db.from("companies").select("stripe_customer_id").eq("id", companyId).single();
    const customerId = (co?.stripe_customer_id as string | null) ?? null;
    if (!customerId) return;
    await reportMeterEvent(RUBY_METER_EVENT, customerId, 1);
    await db.from("ruby_applicant_credits").update({ charged: true }).eq("application_id", applicationId);
  } catch {
    /* metering must never break Ruby */
  }
}

/** How many Ruby applicant credits the company has used this calendar month
 *  (for the "X / 40 screens this month" display). Best-effort → 0 on error. */
export async function rubyAllowanceUsed(
  companyId: string
): Promise<{ used: number; included: number }> {
  try {
    const db = createAdminClient();
    const { count } = await db
      .from("ruby_applicant_credits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("consumed_at", monthStartISO());
    return { used: count ?? 0, included: RUBY_INCLUDED_PER_MONTH };
  } catch {
    return { used: 0, included: RUBY_INCLUDED_PER_MONTH };
  }
}
