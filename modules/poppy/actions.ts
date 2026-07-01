"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsage } from "@/lib/billing/usage";
import { recordPoppyApplicant } from "@/lib/billing/poppy-credits";
import {
  generateInterviewQuestions,
  type InterviewQuestionGroup,
} from "@/lib/ai/generate-interview-questions";
import { generatePoppyAnalysis, synthesizePoppyReport, type PoppyReportData } from "@/lib/ai/generate-poppy-report";
import { startPoppyConversation } from "@/lib/poppy/conversation";
import { loadPoppyRuntimeConfig, readPoppyConfig, type PoppyConfig } from "@/lib/poppy/config";

export type InterviewQuestionsResult = {
  entitled: boolean; // company has Poppy
  status: "ready" | "needs_input" | "not_entitled" | "error";
  groups?: InterviewQuestionGroup[];
  generatedAt?: string | null;
  error?: string;
};

const fmtVal = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Turn an application's answers jsonb into readable "Question: answer" lines. */
function formatAnswers(answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return null;
  const lines: string[] = [];
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(`${k}: ${fmtVal(v)}`);
  }
  return lines.length ? lines.join("\n") : null;
}

type SubRow = { form_id: string; answers: unknown; forms: { name: string | null } | null };

/** Gather the applicant's submitted forms — the application form AND any forms
 *  added in the workflow — as readable "Label: answer" blocks, with field labels
 *  resolved from form_fields. This is Poppy's primary input. */
async function gatherFormsText(applicationId: string, onlyFormIds?: string[]): Promise<string | null> {
  const admin = createAdminClient();
  let q = admin
    .from("form_submissions")
    .select("form_id, answers, forms(name)")
    .eq("application_id", applicationId);
  if (onlyFormIds && onlyFormIds.length) q = q.in("form_id", onlyFormIds);
  const { data: subs } = await q;
  const rows = (subs as unknown as SubRow[]) ?? [];
  if (!rows.length) return null;

  const formIds = [...new Set(rows.map((r) => r.form_id))];
  const { data: fieldRows } = await admin.from("form_fields").select("id, label").in("form_id", formIds);
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

type AppRow = {
  id: string;
  company_id: string;
  applicant_id: string | null;
  cv_path: string | null;
  answers: unknown;
  cover_message: string | null;
  applicants: { first_name: string | null; last_name: string | null } | null;
  jobs: { title: string | null; description: string | null } | null;
};

/** Run the AI generation for an application and store the result. Caller must
 *  have already confirmed entitlement + tenant ownership + a CV is present. */
async function generateAndStore(
  app: AppRow,
  userId: string
): Promise<InterviewQuestionGroup[]> {
  const admin = createAdminClient();

  // Attach the CV only if it's a PDF (Claude documents are PDF-only).
  let cvBase64Pdf: string | null = null;
  if (app.cv_path && app.cv_path.toLowerCase().endsWith(".pdf")) {
    try {
      const { data: blob } = await admin.storage.from("applications").download(app.cv_path);
      if (blob) cvBase64Pdf = Buffer.from(await blob.arrayBuffer()).toString("base64");
    } catch {
      /* generate without the CV rather than fail */
    }
  }

  const name = [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ").trim() || "the candidate";

  // Primary input: the submitted application form + any workflow forms. The
  // legacy applications.answers (apply-form basics) is appended; CV is a bonus.
  const formsText = await gatherFormsText(app.id);
  const answersText = [formsText, formatAnswers(app.answers)].filter(Boolean).join("\n\n") || null;

  const groups = await generateInterviewQuestions({
    jobTitle: app.jobs?.title ?? "Care role",
    jobDescription: app.jobs?.description ?? "",
    applicantName: name,
    coverMessage: app.cover_message,
    answersText,
    cvBase64Pdf,
  });

  // Poppy AI usage is metered like any AI action (10p). Slice 2 will suppress
  // this for companies on the Poppy monthly "included" option.
  await recordUsage(app.company_id, "ai");

  await admin
    .from("application_interview_questions")
    .upsert(
      {
        company_id: app.company_id,
        application_id: app.id,
        questions: groups,
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        generated_by: userId,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "application_id" }
    );

  return groups;
}

async function loadApp(applicationId: string, companyId: string): Promise<AppRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("applications")
    .select(
      "id, company_id, applicant_id, cv_path, answers, cover_message, applicants(first_name, last_name), jobs(title, description)"
    )
    .eq("id", applicationId)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as unknown as AppRow) ?? null;
}

/** Poppy can run once the applicant has submitted any form (application or
 *  workflow) or a CV — the application form is the default input. */
async function hasInput(app: AppRow): Promise<boolean> {
  if (app.cv_path) return true;
  if (app.answers && typeof app.answers === "object" && Object.keys(app.answers).length > 0) return true;
  const { count } = await createAdminClient()
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("application_id", app.id);
  return (count ?? 0) > 0;
}

/**
 * Load (and, on first view, auto-generate) Poppy interview questions for an
 * application. Staff-only and tenant-scoped. No-op unless the company has Poppy.
 */
export async function getInterviewQuestions(applicationId: string): Promise<InterviewQuestionsResult> {
  const { supabase, user, current } = await requireCompany();

  const { data: company } = await supabase
    .from("companies")
    .select("poppy_enabled")
    .eq("id", current.company_id)
    .single();
  if (company?.poppy_enabled !== true) return { entitled: false, status: "not_entitled" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("application_interview_questions")
    .select("questions, generated_at")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .maybeSingle();

  if (existing) {
    return {
      entitled: true,
      status: "ready",
      groups: (existing.questions as InterviewQuestionGroup[]) ?? [],
      generatedAt: existing.generated_at as string,
    };
  }

  const app = await loadApp(applicationId, current.company_id);
  if (!app) return { entitled: true, status: "error", error: "Application not found." };
  if (!(await hasInput(app))) return { entitled: true, status: "needs_input" };

  try {
    const groups = await generateAndStore(app, user.id);
    return { entitled: true, status: "ready", groups, generatedAt: new Date().toISOString() };
  } catch (e) {
    return { entitled: true, status: "error", error: e instanceof Error ? e.message : "Generation failed." };
  }
}

export type PoppyReportResult = {
  entitled: boolean;
  status: "ready" | "none";
  phase?: string; // analysed | conversing | complete | declined
  report?: PoppyReportData;
  generatedAt?: string | null;
};

/** Load the Poppy report for an application (staff-only, tenant-scoped). Returns
 *  entitled=false when the company doesn't have Poppy, {status:'none'} when no
 *  report exists yet. `phase` says where the screening conversation is up to. */
export async function getPoppyReport(applicationId: string): Promise<PoppyReportResult> {
  const { current } = await requireCompany();
  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("poppy_enabled").eq("id", current.company_id).single();
  if (co?.poppy_enabled !== true) return { entitled: false, status: "none" };

  const { data } = await admin
    .from("poppy_reports")
    .select("status, phase, report, generated_at")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (data && data.status === "ready") {
    return {
      entitled: true,
      status: "ready",
      phase: (data.phase as string) ?? "complete",
      report: data.report as PoppyReportData,
      generatedAt: data.generated_at as string,
    };
  }
  return { entitled: true, status: "none" };
}

type ManualAppRow = {
  id: string;
  company_id: string;
  cv_path: string | null;
  answers: unknown;
  cover_message: string | null;
  applicants: { first_name: string | null; last_name: string | null } | null;
  jobs: { title: string | null; description: string | null; role_id: string | null } | null;
};

/** Run Poppy now for one application (manual "Run / Regenerate"). Respects the
 *  applicable Poppy step's selected forms + CV when one exists; otherwise reviews
 *  everything submitted. Generates the report, stores it, meters the AI. Does NOT
 *  notify the owner (that's for the automatic workflow run). */
export async function runPoppyForApplication(
  applicationId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  const admin = createAdminClient();

  const { data: co } = await admin.from("companies").select("poppy_enabled").eq("id", current.company_id).single();
  if (co?.poppy_enabled !== true) return { error: "Poppy isn't enabled for this company." };

  const { data: appRaw } = await admin
    .from("applications")
    .select("id, company_id, cv_path, answers, cover_message, applicants(first_name, last_name), jobs(title, description, role_id)")
    .eq("id", applicationId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  const app = appRaw as unknown as ManualAppRow | null;
  if (!app) return { error: "Application not found." };

  // Is there already a report? A re-run must NOT re-contact the applicant.
  const { data: existing } = await admin
    .from("poppy_reports")
    .select("phase, report")
    .eq("application_id", app.id)
    .eq("company_id", current.company_id)
    .maybeSingle();

  // Re-run on a COMPLETED screening → just refresh the verdict from the existing
  // answers (don't re-analyse or re-message).
  if (existing && existing.phase === "complete") {
    const data = (existing.report as PoppyReportData) ?? { summary: "", concerns: [], questions: [] };
    if (data.questions?.some((q) => q.answer)) {
      try {
        const rcfg = await loadPoppyRuntimeConfig(current.company_id);
        const synth = await synthesizePoppyReport(
          {
            jobTitle: app.jobs?.title ?? "Care role",
            jobDescription: app.jobs?.description ?? "",
            applicantName: [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ") || "the candidate",
            coverMessage: app.cover_message,
            answersText: [await gatherFormsText(app.id), formatAnswers(app.answers)].filter(Boolean).join("\n\n") || null,
            cvBase64Pdf: null,
            referenceDocs: rcfg.referenceDocs,
            focus: rcfg.focus,
            instructions: rcfg.instructions,
          },
          data.concerns ?? [],
          data.questions ?? []
        );
        if (synth.summary.length) data.summary = synth.summary;
        data.recommendation = synth.recommendation;
        await admin.from("poppy_reports").update({ report: data, generated_at: new Date().toISOString() }).eq("application_id", app.id);
        // Re-run on an existing applicant → credit already claimed; idempotent.
        await recordPoppyApplicant(current.company_id, app.id);
        return { ok: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Poppy couldn't refresh the report." };
      }
    }
  }

  // Find an applicable Poppy step (for its selected forms + CV choice).
  const { data: stepsRaw } = await admin
    .from("onboarding_templates")
    .select("poppy_form_ids, poppy_include_cv, role_ids")
    .eq("company_id", current.company_id)
    .eq("is_store", false)
    .eq("task_type", "poppy");
  const steps = (stepsRaw ?? []) as { poppy_form_ids: string[] | null; poppy_include_cv: boolean | null; role_ids: string[] | null }[];
  const roleId = app.jobs?.role_id ?? null;
  const step = steps.find((s) => !s.role_ids || s.role_ids.length === 0 || (!!roleId && s.role_ids.includes(roleId))) ?? null;

  // If a step restricts the forms, review only those; else review everything.
  const onlyFormIds = step && (step.poppy_form_ids ?? []).length > 0 ? (step.poppy_form_ids as string[]) : undefined;
  // Include the CV when the step says so, or (no step) by default if present.
  const includeCv = step ? step.poppy_include_cv === true : true;

  let cvBase64Pdf: string | null = null;
  if (includeCv && app.cv_path && app.cv_path.toLowerCase().endsWith(".pdf")) {
    try {
      const { data: blob } = await admin.storage.from("applications").download(app.cv_path);
      if (blob) cvBase64Pdf = Buffer.from(await blob.arrayBuffer()).toString("base64");
    } catch {
      /* generate without CV */
    }
  }

  const formsText = await gatherFormsText(app.id, onlyFormIds);
  const answersText = [formsText, formatAnswers(app.answers)].filter(Boolean).join("\n\n") || null;
  if (!answersText && !cvBase64Pdf) {
    return { error: "Nothing to review yet — the applicant hasn't submitted a form or CV." };
  }
  const name = [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ").trim() || "the candidate";

  const cfg = await loadPoppyRuntimeConfig(current.company_id);
  let analysis: { summary: string[]; concerns: string[]; questions: { question: string; rationale: string }[] };
  try {
    analysis = await generatePoppyAnalysis({
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
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Poppy couldn't analyse the application." };
  }

  const report: PoppyReportData = { summary: analysis.summary, concerns: analysis.concerns, questions: analysis.questions };
  await admin.from("poppy_reports").upsert(
    {
      company_id: current.company_id,
      application_id: app.id,
      status: "ready",
      phase: "analysed",
      report,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      generated_at: new Date().toISOString(),
    },
    { onConflict: "application_id" }
  );
  // Poppy is billed per applicant (40 included/month, then 75p), NOT via the 10p
  // AI meter. One credit per applicant, deduped by application_id.
  await recordPoppyApplicant(current.company_id, app.id);
  // Only start the screening conversation (consent message + nudge SMS) on the
  // FIRST run — a re-run must never re-contact the applicant.
  if (!existing) {
    await startPoppyConversation(admin, app.id);
  }
  return { ok: true };
}

/** Founder: turn the Poppy entitlement on/off for a company. */
export async function setCompanyPoppyEnabled(companyId: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  await createAdminClient().from("companies").update({ poppy_enabled: enabled }).eq("id", companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
}

/** Save the company's Poppy Settings config (admin-only) into companies.settings.poppy. */
export async function savePoppySettings(
  input: PoppyConfig
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change Poppy settings." };

  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("poppy_enabled, settings").eq("id", current.company_id).single();
  if (co?.poppy_enabled !== true) return { error: "Poppy isn't enabled for this company." };

  const clean: PoppyConfig = {
    documentIds: Array.isArray(input.documentIds) ? input.documentIds.filter((x) => typeof x === "string").slice(0, 50) : [],
    focus: Array.isArray(input.focus) ? input.focus.filter((x) => typeof x === "string").slice(0, 20) : [],
    instructions: typeof input.instructions === "string" ? input.instructions.slice(0, 2000) : "",
    questionCount: Math.min(20, Math.max(1, Math.round(Number(input.questionCount) || 8))),
  };

  const settings = { ...(co.settings && typeof co.settings === "object" ? (co.settings as Record<string, unknown>) : {}), poppy: clean };
  const { error } = await admin.from("companies").update({ settings }).eq("id", current.company_id);
  if (error) return { error: "Couldn't save Poppy settings." };

  void supabase; // tenant already resolved via requireCompany
  revalidatePath("/settings");
  return { ok: true };
}

/** Load the company's saved Poppy config for the Settings form. */
export async function getPoppySettings(): Promise<PoppyConfig> {
  const { current } = await requireCompany();
  const { data: co } = await createAdminClient().from("companies").select("settings").eq("id", current.company_id).single();
  return readPoppyConfig(co?.settings);
}

/** Force a fresh generation (Regenerate button). Re-meters as an AI action. */
export async function regenerateInterviewQuestions(applicationId: string): Promise<InterviewQuestionsResult> {
  const { user, current } = await requireCompany();

  const { data: company } = await createAdminClient()
    .from("companies")
    .select("poppy_enabled")
    .eq("id", current.company_id)
    .single();
  if (company?.poppy_enabled !== true) return { entitled: false, status: "not_entitled" };

  const app = await loadApp(applicationId, current.company_id);
  if (!app) return { entitled: true, status: "error", error: "Application not found." };
  if (!(await hasInput(app))) return { entitled: true, status: "needs_input" };

  try {
    const groups = await generateAndStore(app, user.id);
    return { entitled: true, status: "ready", groups, generatedAt: new Date().toISOString() };
  } catch (e) {
    return { entitled: true, status: "error", error: e instanceof Error ? e.message : "Generation failed." };
  }
}
