import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Data retention engine (UK GDPR — storage limitation)
// ------------------------------------------------------------
// Each company (controller) sets its own retention periods in
// companies.settings.retention. This daily cron hard-erases data whose period
// has lapsed, reusing erase_applicant_at_company (which also clears storage via
// the returned paths — handled here). OFF by default: nothing is deleted until a
// company opts in and sets a period, because retention is the controller's call.
//
//   settings.retention = {
//     unsuccessful: { enabled: bool, months: int },  // rejected, never hired
//     leavers:      { enabled: bool, years: int },    // employees who have left
//   }
//
// Talent-pool candidates (consent-based retention) are handled separately by the
// talent-pool purge and are skipped here.
// ============================================================

type Db = ReturnType<typeof createAdminClient>;

type RetentionCfg = {
  unsuccessful?: { enabled?: boolean; months?: number };
  leavers?: { enabled?: boolean; years?: number };
};

export type RetentionRun = { erased: number; companies: number; failed: number };

const MS_DAY = 86_400_000;
// Safety cap: never erase more than this many subjects per company per run.
const PER_COMPANY_CAP = 200;

async function erase(db: Db, companyId: string, applicantId: string): Promise<boolean> {
  const { data, error } = await db.rpc("erase_applicant_at_company", {
    p_company_id: companyId,
    p_applicant_id: applicantId,
  });
  if (error) return false;
  const r = (data ?? {}) as { storage_applications?: string[]; storage_hr?: string[] };
  const appPaths = (r.storage_applications ?? []).filter(Boolean);
  const hrPaths = (r.storage_hr ?? []).filter(Boolean);
  if (appPaths.length) await db.storage.from("applications").remove(appPaths).catch(() => {});
  if (hrPaths.length) await db.storage.from("hr-documents").remove(hrPaths).catch(() => {});
  return true;
}

export async function runRetention(): Promise<RetentionRun> {
  const db = createAdminClient();
  const result: RetentionRun = { erased: 0, companies: 0, failed: 0 };
  const now = Date.now();

  const { data: companies } = await db.from("companies").select("id, settings");

  for (const c of companies ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = (((c as any).settings?.retention ?? {}) as RetentionCfg);
    const companyId = (c as { id: string }).id;
    let touched = false;
    let erasedHere = 0;

    // 1) Unsuccessful applicants: every application at this company is 'rejected',
    //    none hired/active, not talent-pool-consented, last activity older than N months.
    if (cfg.unsuccessful?.enabled && (cfg.unsuccessful.months ?? 0) > 0) {
      const cutoff = new Date(now - (cfg.unsuccessful.months as number) * 30 * MS_DAY).toISOString();
      const { data: apps } = await db
        .from("applications")
        .select("applicant_id, stage, updated_at, applicants(talent_pool)")
        .eq("company_id", companyId);

      // Group by applicant; eligible only if ALL apps are rejected, all older than
      // the cutoff, and the applicant has not consented to the talent pool.
      const byApplicant = new Map<string, { allRejected: boolean; newest: number; consented: boolean }>();
      for (const a of apps ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = a as any;
        const g = byApplicant.get(row.applicant_id) ?? { allRejected: true, newest: 0, consented: false };
        if (row.stage !== "rejected") g.allRejected = false;
        const t = new Date(row.updated_at).getTime();
        if (t > g.newest) g.newest = t;
        if (row.applicants?.talent_pool) g.consented = true;
        byApplicant.set(row.applicant_id, g);
      }
      const cutoffMs = new Date(cutoff).getTime();
      for (const [applicantId, g] of byApplicant) {
        if (erasedHere >= PER_COMPANY_CAP) break;
        if (!g.allRejected || g.consented) continue;
        if (g.newest > cutoffMs) continue;
        touched = true;
        if (await erase(db, companyId, applicantId)) { result.erased += 1; erasedHere += 1; }
        else result.failed += 1;
      }
    }

    // 2) Leavers: employees who left more than Y years ago.
    if (cfg.leavers?.enabled && (cfg.leavers.years ?? 0) > 0) {
      const cutoff = new Date(now - (cfg.leavers.years as number) * 365 * MS_DAY).toISOString();
      const { data: leavers } = await db
        .from("employees")
        .select("applicant_id, left_at, status")
        .eq("company_id", companyId)
        .eq("status", "left")
        .not("applicant_id", "is", null)
        .lt("left_at", cutoff);
      for (const e of leavers ?? []) {
        if (erasedHere >= PER_COMPANY_CAP) break;
        const applicantId = (e as { applicant_id: string }).applicant_id;
        touched = true;
        if (await erase(db, companyId, applicantId)) { result.erased += 1; erasedHere += 1; }
        else result.failed += 1;
      }
    }

    if (touched) result.companies += 1;
  }

  return result;
}
