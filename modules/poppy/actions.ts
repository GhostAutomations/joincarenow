"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsage } from "@/lib/billing/usage";
import {
  generateInterviewQuestions,
  type InterviewQuestionGroup,
} from "@/lib/ai/generate-interview-questions";
import type { PoppyReport } from "@/lib/ai/generate-poppy-report";

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
async function gatherFormsText(applicationId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("form_submissions")
    .select("form_id, answers, forms(name)")
    .eq("application_id", applicationId);
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
  status: "ready" | "none";
  report?: PoppyReport;
  generatedAt?: string | null;
};

/** Load the workflow-generated Poppy report for an application (staff-only,
 *  tenant-scoped). Returns {status:'none'} when none exists yet. */
export async function getPoppyReport(applicationId: string): Promise<PoppyReportResult> {
  const { current } = await requireCompany();
  const { data } = await createAdminClient()
    .from("poppy_reports")
    .select("status, report, generated_at")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (data && data.status === "ready") {
    return { status: "ready", report: data.report as PoppyReport, generatedAt: data.generated_at as string };
  }
  return { status: "none" };
}

/** Founder: turn the Poppy entitlement on/off for a company. */
export async function setCompanyPoppyEnabled(companyId: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  await createAdminClient().from("companies").update({ poppy_enabled: enabled }).eq("id", companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
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
