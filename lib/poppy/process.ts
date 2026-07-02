import { createAdminClient } from "@/lib/supabase/admin";
import { recordPoppyApplicant } from "@/lib/billing/poppy-credits";
import { generatePoppyAnalysis, type PoppyReportData } from "@/lib/ai/generate-poppy-report";
import { startPoppyConversation } from "@/lib/poppy/conversation";
import { loadPoppyRuntimeConfig } from "@/lib/poppy/config";

type Admin = ReturnType<typeof createAdminClient>;

// Pipeline order so a 'stage' engage means "at or past" the chosen stage.
const STAGE_ORDER = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired"];
const mapTrigger = (s: string | null): string => (s === "on_application" ? "applied" : s ?? "");
const stageReached = (current: string, trigger: string | null): boolean => {
  const ci = STAGE_ORDER.indexOf(current);
  const ti = STAGE_ORDER.indexOf(mapTrigger(trigger));
  return ti >= 0 && ci >= ti;
};

const fmtVal = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);

function formatAnswers(answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return null;
  const lines: string[] = [];
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(`${k}: ${fmtVal(v)}`);
  }
  return lines.length ? lines.join("\n") : null;
}

type Sub = { form_id: string; answers: unknown; forms: { name: string | null } | null };

async function gatherFormsText(db: Admin, applicationId: string): Promise<string | null> {
  const { data: subs } = await db
    .from("form_submissions")
    .select("form_id, answers, forms(name)")
    .eq("application_id", applicationId);
  const rows = (subs as unknown as Sub[]) ?? [];
  if (!rows.length) return null;
  const formIds = [...new Set(rows.map((r) => r.form_id))];
  const { data: fieldRows } = await db.from("form_fields").select("id, label").in("form_id", formIds);
  const labelOf = new Map((fieldRows ?? []).map((f) => [f.id as string, f.label as string]));
  const blocks: string[] = [];
  for (const r of rows) {
    if (!r.answers || typeof r.answers !== "object") continue;
    const lines: string[] = [];
    for (const [k, v] of Object.entries(r.answers as Record<string, unknown>)) {
      if (v === null || v === undefined || v === "") continue;
      lines.push(`${labelOf.get(k) ?? k}: ${fmtVal(v)}`);
    }
    if (lines.length) blocks.push(`Form — ${r.forms?.name ?? "Form"}:\n${lines.join("\n")}`);
  }
  return blocks.length ? blocks.join("\n\n") : null;
}

async function downloadCvPdf(db: Admin, cvPath: string | null): Promise<string | null> {
  if (!cvPath || !cvPath.toLowerCase().endsWith(".pdf")) return null;
  try {
    const { data: blob } = await db.storage.from("applications").download(cvPath);
    if (blob) return Buffer.from(await blob.arrayBuffer()).toString("base64");
  } catch {
    /* generate without CV */
  }
  return null;
}

type PoppyStep = {
  poppy_engage: string | null;
  poppy_form_ids: string[] | null;
  poppy_include_cv: boolean | null;
  trigger_stage: string | null;
  role_ids: string[] | null;
  poppy_focus: string[] | null;
  poppy_instructions: string | null;
  poppy_question_count: number | null;
  poppy_document_ids: string[] | null;
};
type AppRow = {
  id: string;
  stage: string;
  cv_path: string | null;
  answers: unknown;
  cover_message: string | null;
  jobs: { title: string | null; description: string | null; role_id: string | null } | null;
  applicants: { first_name: string | null; last_name: string | null } | null;
};

/** Does this Poppy step's engage condition hold for this application? The CV (if
 *  selected) counts as a reviewable item — "complete" once a CV is uploaded. */
async function conditionMet(db: Admin, app: AppRow, step: PoppyStep): Promise<boolean> {
  const engage = step.poppy_engage;
  if (engage === "stage") return stageReached(app.stage, step.trigger_stage);

  const formIds = (step.poppy_form_ids ?? []).filter(Boolean);
  const wantCv = step.poppy_include_cv === true;
  const cvDone = !!app.cv_path;
  if (formIds.length === 0 && !wantCv) return false;

  let done = new Set<string>();
  if (formIds.length > 0) {
    const { data: subs } = await db
      .from("form_submissions")
      .select("form_id")
      .eq("application_id", app.id)
      .in("form_id", formIds);
    done = new Set((subs ?? []).map((s) => s.form_id as string));
  }

  if (engage === "all_forms") {
    return formIds.every((f) => done.has(f)) && (!wantCv || cvDone);
  }
  if (engage === "as_forms") {
    return done.size > 0 || (wantCv && cvDone);
  }
  return false;
}

function stepApplies(step: PoppyStep, roleId: string | null): boolean {
  const roles = step.role_ids ?? [];
  return roles.length === 0 || (!!roleId && roles.includes(roleId));
}

export type PoppyRun = { generated: number; skipped: number; errors: number };

/**
 * Reconcile Poppy workflow steps: for each Poppy-enabled company, find candidate
 * applications whose Poppy step has engaged but which have no report yet, then
 * generate the report, store it, meter the AI action, and notify the job owner.
 * Idempotent: one report per application (unique application_id) — so each
 * application is processed once. Bounded by `limit` per run.
 */
export async function runPoppy(limit = 25): Promise<PoppyRun> {
  const res: PoppyRun = { generated: 0, skipped: 0, errors: 0 };
  if (!process.env.ANTHROPIC_API_KEY) return res;
  const db = createAdminClient();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const { data: companies } = await db.from("companies").select("id").eq("poppy_enabled", true);
  for (const co of companies ?? []) {
    if (res.generated >= limit) break;
    const companyId = co.id as string;

    const { data: stepsRaw } = await db
      .from("onboarding_templates")
      .select("poppy_engage, poppy_form_ids, poppy_include_cv, trigger_stage, role_ids, poppy_focus, poppy_instructions, poppy_question_count, poppy_document_ids")
      .eq("company_id", companyId)
      .eq("is_store", false)
      .eq("task_type", "poppy");
    const steps = (stepsRaw as unknown as PoppyStep[]) ?? [];
    if (steps.length === 0) continue;

    const { data: appsRaw } = await db
      .from("applications")
      .select("id, stage, cv_path, answers, cover_message, jobs(title, description, role_id), applicants(first_name, last_name)")
      .eq("company_id", companyId)
      .neq("stage", "rejected")
      .limit(200);
    const apps = (appsRaw as unknown as AppRow[]) ?? [];
    if (apps.length === 0) continue;

    // Applications that already have a report — skip (idempotent, cost-bounded).
    const { data: existing } = await db
      .from("poppy_reports")
      .select("application_id")
      .in("application_id", apps.map((a) => a.id));
    const haveReport = new Set((existing ?? []).map((e) => e.application_id as string));

    for (const app of apps) {
      if (res.generated >= limit) break;
      if (haveReport.has(app.id)) continue;
      const roleId = app.jobs?.role_id ?? null;

      let chosen: PoppyStep | null = null;
      for (const s of steps) {
        if (!stepApplies(s, roleId)) continue;
        if (await conditionMet(db, app, s)) {
          chosen = s;
          break;
        }
      }
      if (!chosen) {
        res.skipped++;
        continue;
      }

      // Re-check right before the expensive AI call: a manual "Run Poppy" (or a
      // prior run) may have created the report since we built `haveReport`, so we
      // don't clobber it, waste an AI call, or double-message the applicant.
      const { data: fresh } = await db.from("poppy_reports").select("id").eq("application_id", app.id).maybeSingle();
      if (fresh) {
        res.skipped++;
        continue;
      }

      try {
        // Only read the CV if this step's reviewer list includes it.
        const cvBase64Pdf = chosen.poppy_include_cv === true ? await downloadCvPdf(db, app.cv_path) : null;
        const formsText = await gatherFormsText(db, app.id);
        const answersText = [formsText, formatAnswers(app.answers)].filter(Boolean).join("\n\n") || null;
        const name =
          [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ").trim() || "the candidate";

        // Phase 1 — analyse into concerns + questions. The conversation (Slice B)
        // asks the questions; the final report is written once they're answered.
        const cfg = await loadPoppyRuntimeConfig(companyId, chosen);
        const analysis = await generatePoppyAnalysis({
          jobTitle: app.jobs?.title ?? "Care role",
          jobDescription: app.jobs?.description ?? "",
          applicantName: name,
          coverMessage: app.cover_message,
          answersText,
          cvBase64Pdf,
          referenceDocs: cfg.referenceDocs,
          focus: cfg.focus,
          instructions: cfg.instructions,
          questionCount: cfg.questionCount,
          requiredAttributes: cfg.requiredAttributes,
          desiredAttributes: cfg.desiredAttributes,
        });
        const report: PoppyReportData = {
          summary: analysis.summary,
          concerns: analysis.concerns,
          questions: analysis.questions,
        };

        // Insert-if-absent (never overwrite an existing report). If a concurrent
        // run created one in the meantime, `ins` is empty and we bail — no
        // clobber, no second conversation.
        const { data: ins } = await db
          .from("poppy_reports")
          .upsert(
            {
              company_id: companyId,
              application_id: app.id,
              status: "ready",
              phase: "analysed",
              report,
              model,
              generated_at: new Date().toISOString(),
            },
            { onConflict: "application_id", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();
        if (!ins) {
          res.skipped++;
          continue;
        }
        // Poppy is billed per applicant (40 included/month, then 75p) — NOT via
        // the generic 10p AI meter. One credit per applicant, deduped.
        await recordPoppyApplicant(companyId, app.id);
        // Kick off the screening conversation (consent message + nudge SMS).
        await startPoppyConversation(db, app.id);
        res.generated++;
      } catch (e) {
        res.errors++;
        await db.from("poppy_reports").upsert(
          {
            company_id: companyId,
            application_id: app.id,
            status: "error",
            error: e instanceof Error ? e.message.slice(0, 500) : "Generation failed",
            generated_at: new Date().toISOString(),
          },
          { onConflict: "application_id" }
        );
      }
    }
  }
  return res;
}
