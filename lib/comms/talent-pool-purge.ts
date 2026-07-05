import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrandedEmail } from "@/lib/comms/branded";

// ============================================================
// Talent pool retention (UK GDPR)
// ------------------------------------------------------------
// A candidate who declines an offer or is not progressed can opt in to the
// company's talent pool (consent captured in migrations 0071 / 0081, stored on
// applicants.talent_pool + talent_pool_consent_at). Consent lasts six months.
//
// This daily cron does two things per consented applicant:
//   1. WARN, ~14 days before the six months lapse: a branded email with a
//      one-tap "keep my details" button that re-consents and resets the clock.
//   2. PURGE, once the six months have lapsed: delete the applicant's retained
//      applications at each company where they are dormant (not in an active
//      process and not hired), then clear the expired consent flag.
//
// Runs from Vercel Cron with the service-role client (no session, RLS bypassed),
// so every query is explicitly scoped by applicant and company. We delete
// directly rather than via remove_applicant_from_pool(), because that RPC's
// is_company_member guard fails under the service role (auth.uid() is null).
// ============================================================

type Db = ReturnType<typeof createAdminClient>;

const BASE_URL = "https://www.joincarenow.com";
const RETENTION_DAYS = 183; // ~6 months
const WARN_LEAD_DAYS = 14; // heads-up this many days before expiry
const MS_DAY = 86_400_000;

// An applicant with any of these stages at a company is still in an active
// process there (or employed) and is NOT a dormant talent-pool record.
const ACTIVE_OR_HIRED = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired"];

export type TalentPoolPurgeRun = {
  warned: number;
  purgedApplications: number;
  purgedCompanies: number;
  failed: number;
};

type AppRow = {
  id: string;
  company_id: string;
  stage: string;
  talent_pool_token: string | null;
  jobs: { title: string | null } | null;
  companies: { name: string | null } | null;
};

export async function runTalentPoolPurge(): Promise<TalentPoolPurgeRun> {
  const db = createAdminClient();
  const result: TalentPoolPurgeRun = { warned: 0, purgedApplications: 0, purgedCompanies: 0, failed: 0 };

  const now = Date.now();
  const expiryCutoff = new Date(now - RETENTION_DAYS * MS_DAY).toISOString(); // consent_at <= this => expired
  const warnCutoff = new Date(now - (RETENTION_DAYS - WARN_LEAD_DAYS) * MS_DAY).toISOString(); // consent_at <= this => warn window or later

  // Consented applicants whose consent has aged into (at least) the warn window.
  const { data: applicants } = await db
    .from("applicants")
    .select("id, first_name, email, talent_pool_consent_at")
    .eq("talent_pool", true)
    .not("talent_pool_consent_at", "is", null)
    .lte("talent_pool_consent_at", warnCutoff);

  for (const ap of applicants ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = ap as any;
    const consentAtIso: string = row.talent_pool_consent_at;
    const expired = consentAtIso <= expiryCutoff;

    const { data: apps } = await db
      .from("applications")
      .select("id, company_id, stage, talent_pool_token, jobs(title), companies(name)")
      .eq("applicant_id", row.id);

    // No applications left to retain — clear the expired flag and move on.
    if (!apps || apps.length === 0) {
      if (expired) await clearConsent(db, row.id);
      continue;
    }

    // Group by company; a company is eligible only if the applicant is dormant
    // there (no active/hired application).
    const byCompany = new Map<
      string,
      { companyName: string; jobTitle: string; appIds: string[]; token: string | null; active: boolean }
    >();
    for (const a of apps as unknown as AppRow[]) {
      const g =
        byCompany.get(a.company_id) ??
        { companyName: a.companies?.name ?? "", jobTitle: a.jobs?.title ?? "", appIds: [], token: null, active: false };
      g.appIds.push(a.id);
      if (a.talent_pool_token) g.token = a.talent_pool_token;
      if (ACTIVE_OR_HIRED.includes(a.stage)) g.active = true;
      byCompany.set(a.company_id, g);
    }

    let applicantHadError = false;

    for (const [companyId, g] of byCompany) {
      if (g.active) continue; // active process or employed — leave the data alone

      if (expired) {
        const { error } = await db
          .from("applications")
          .delete()
          .eq("applicant_id", row.id)
          .eq("company_id", companyId);
        if (error) {
          result.failed += 1;
          applicantHadError = true;
          continue;
        }
        await db.from("audit_logs").insert({
          company_id: companyId,
          action: "talent_pool.purged",
          entity_type: "applicant",
          entity_id: row.id,
          after: { reason: "six_month_retention_expired", applications_removed: g.appIds.length },
        });
        result.purgedApplications += g.appIds.length;
        result.purgedCompanies += 1;
      } else {
        // Warn window: one heads-up per company per consent cycle.
        if (!row.email) continue;
        const cycle = consentAtIso.slice(0, 10);
        const dedupeKey = `talent_pool_warn:${companyId}:${row.id}:${cycle}`;
        const { data: already } = await db
          .from("reminder_log")
          .select("id")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();
        if (already) continue;

        // Ensure a re-consent token exists (offer-decline consent may not have one).
        let token = g.token;
        if (!token) {
          token = crypto.randomUUID();
          await db.from("applications").update({ talent_pool_token: token }).eq("id", g.appIds[0]);
        }

        const firstName = row.first_name || "there";
        const subject = `Do you still want ${g.companyName} to keep your details?`;
        const body =
          `Hi ${firstName},\n\n` +
          `A while ago you asked ${g.companyName} to keep your details on file so they could contact you when a suitable role came up. That six month period is coming to an end.\n\n` +
          `If you are happy for ${g.companyName} to keep your details for another six months, please tap the button below. If you do nothing, your details will be removed automatically and you do not need to take any action.\n\n` +
          `Kind regards,\n${g.companyName}`;

        const r = await sendBrandedEmail(db, companyId, {
          to: row.email,
          subject,
          text: body,
          cta: { label: "Keep my details on file", url: `${BASE_URL}/talent-pool/${token}` },
        });

        await db.from("messages").insert({
          company_id: companyId,
          application_id: g.appIds[0],
          applicant_id: row.id,
          channel: "email",
          direction: "outbound",
          to_address: row.email,
          subject,
          body,
          status: r.ok ? "sent" : "failed",
          provider_id: r.id ?? null,
          error: r.ok ? null : r.error ?? null,
          created_by: null,
        });
        await db.from("reminder_log").insert({ company_id: companyId, kind: "talent_pool_warn", dedupe_key: dedupeKey });

        if (r.ok) result.warned += 1;
        else result.failed += 1;
      }
    }

    // The six month consent has lapsed by definition; drop the expired flag so
    // the applicant is not re-scanned every day. Any active/hired data that was
    // deliberately kept remains under its own lawful basis. Skip if a delete
    // failed, so the next run retries.
    if (expired && !applicantHadError) await clearConsent(db, row.id);
  }

  return result;
}

async function clearConsent(db: Db, applicantId: string): Promise<void> {
  await db.from("applicants").update({ talent_pool: false, talent_pool_consent_at: null }).eq("id", applicantId);
}
