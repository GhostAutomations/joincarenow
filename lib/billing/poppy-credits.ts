import { createAdminClient } from "@/lib/supabase/admin";
import { reportMeterEvent } from "@/lib/billing/stripe";

/** Poppy applicants included per calendar month on Tier 2. Beyond this, each new
 *  applicant meters at the Poppy overage price (75p). */
export const POPPY_INCLUDED_PER_MONTH = 40;

/** Stripe meter event name for Poppy applicant overage (create the meter with
 *  this event name in Stripe). Overridable via env. */
const POPPY_METER_EVENT = process.env.STRIPE_POPPY_METER_EVENT ?? "poppy_applicant";

/** First moment of the current UTC calendar month. */
function monthStartISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Record that Poppy has screened an applicant and report ONE usage unit to
 * Stripe.
 *
 * Idempotent per applicant: UNIQUE(application_id) means an applicant only ever
 * consumes ONE credit, however many times Poppy runs, re-runs or refreshes for
 * them — so it's reported to Stripe at most once. This is Poppy's ONLY charge:
 * Poppy's internal AI calls do NOT trip the generic 10p AI meter.
 *
 * The included allowance (40/month, 480/year) is applied by the Stripe Price
 * itself, which is set up as GRADUATED tiers (first N units £0, the rest 75p).
 * So we report EVERY applicant and let Stripe zero-rate the free ones — we must
 * NOT also gate the first 40 here, or the allowance would be applied twice.
 *
 * Best-effort: never throws, so metering can't break a Poppy run.
 */
export async function recordPoppyApplicant(
  companyId: string | null | undefined,
  applicationId: string | null | undefined
): Promise<void> {
  if (!companyId || !applicationId) return;
  try {
    const db = createAdminClient();

    // Claim the credit. On a duplicate (applicant already credited) the insert
    // errors on the unique constraint and we stop — no second report.
    const { data: inserted, error } = await db
      .from("poppy_applicant_credits")
      .insert({ company_id: companyId, application_id: applicationId })
      .select("id")
      .maybeSingle();
    if (error || !inserted) return;

    if (!process.env.STRIPE_SECRET_KEY) return;
    const { data: co } = await db.from("companies").select("stripe_customer_id").eq("id", companyId).single();
    const customerId = (co?.stripe_customer_id as string | null) ?? null;
    if (!customerId) return;
    await reportMeterEvent(POPPY_METER_EVENT, customerId, 1);
    await db.from("poppy_applicant_credits").update({ charged: true }).eq("application_id", applicationId);
  } catch {
    /* metering must never break Poppy */
  }
}

/** How many Poppy applicant credits the company has used this calendar month
 *  (for the "X / 40 screens this month" display). Best-effort → 0 on error. */
export async function poppyAllowanceUsed(
  companyId: string
): Promise<{ used: number; included: number }> {
  try {
    const db = createAdminClient();
    const { count } = await db
      .from("poppy_applicant_credits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("consumed_at", monthStartISO());
    return { used: count ?? 0, included: POPPY_INCLUDED_PER_MONTH };
  } catch {
    return { used: 0, included: POPPY_INCLUDED_PER_MONTH };
  }
}
