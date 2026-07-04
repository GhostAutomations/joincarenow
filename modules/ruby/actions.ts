"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherRubyUploads } from "@/lib/ruby/uploads";
import { recordRubyApplicant } from "@/lib/billing/ruby-credits";
import {
  generateInterviewQuestions,
  type InterviewQuestionGroup,
} from "@/lib/ai/generate-interview-questions";
import { generateRubyAnalysis, synthesizeRubyReport, type RubyReportData } from "@/lib/ai/generate-ruby-report";
import { startRubyConversation } from "@/lib/ruby/conversation";
import { loadRubyRuntimeConfig, readRubyConfig, type RubyConfig, type RubyAttrGroup } from "@/lib/ruby/config";

export type InterviewQuestionsResult = {
  entitled: boolean; // company has Ruby
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
 *  resolved from form_fields. This is Ruby's primary input. */
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

  // Interview questions is a Ruby feature — bill it as a Ruby applicant credit
  // (deduped per applicant), NEVER as a company AI action.
  await recordRubyApplicant(app.company_id, app.id);

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

/** Ruby can run once the applicant has submitted any form (application or
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
 * Load (and, on first view, auto-generate) Ruby interview questions for an
 * application. Staff-only and tenant-scoped. No-op unless the company has Ruby.
 */
export async function getInterviewQuestions(applicationId: string): Promise<InterviewQuestionsResult> {
  const { supabase, user, current } = await requireCompany();

  const { data: company } = await supabase
    .from("companies")
    .select("ruby_enabled")
    .eq("id", current.company_id)
    .single();
  if (company?.ruby_enabled !== true) return { entitled: false, status: "not_entitled" };

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

export type RubyReportResult = {
  entitled: boolean;
  status: "ready" | "none";
  phase?: string; // analysed | conversing | complete | declined
  report?: RubyReportData;
  generatedAt?: string | null;
};

/** Load the Ruby report for an application (staff-only, tenant-scoped). Returns
 *  entitled=false when the company doesn't have Ruby, {status:'none'} when no
 *  report exists yet. `phase` says where the screening conversation is up to. */
export async function getRubyReport(applicationId: string): Promise<RubyReportResult> {
  const { current } = await requireCompany();
  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("ruby_enabled").eq("id", current.company_id).single();
  if (co?.ruby_enabled !== true) return { entitled: false, status: "none" };

  const { data } = await admin
    .from("ruby_reports")
    .select("status, phase, report, generated_at")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (data && data.status === "ready") {
    return {
      entitled: true,
      status: "ready",
      phase: (data.phase as string) ?? "complete",
      report: data.report as RubyReportData,
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

/** Run Ruby now for one application (manual "Run / Regenerate"). Respects the
 *  applicable Ruby step's selected forms + CV when one exists; otherwise reviews
 *  everything submitted. Generates the report, stores it, meters the AI. Does NOT
 *  notify the owner (that's for the automatic workflow run). */
export async function runRubyForApplication(
  applicationId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  const admin = createAdminClient();

  const { data: co } = await admin.from("companies").select("ruby_enabled").eq("id", current.company_id).single();
  if (co?.ruby_enabled !== true) return { error: "Ruby isn't enabled for this company." };

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
    .from("ruby_reports")
    .select("phase, report")
    .eq("application_id", app.id)
    .eq("company_id", current.company_id)
    .maybeSingle();

  // Re-run on a COMPLETED screening → just refresh the verdict from the existing
  // answers (don't re-analyse or re-message).
  if (existing && existing.phase === "complete") {
    const data = (existing.report as RubyReportData) ?? { summary: "", concerns: [], questions: [] };
    if (data.questions?.some((q) => q.answer)) {
      try {
        const rcfg = await loadRubyRuntimeConfig(current.company_id);
        const synth = await synthesizeRubyReport(
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
        await admin.from("ruby_reports").update({ report: data, generated_at: new Date().toISOString() }).eq("application_id", app.id);
        // Re-run on an existing applicant → credit already claimed; idempotent.
        await recordRubyApplicant(current.company_id, app.id);
        return { ok: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Ruby couldn't refresh the report." };
      }
    }
  }

  // A screening already in progress (analysed / mid-conversation) — don't
  // re-analyse (it would clobber the questions and conversation state) or
  // re-contact the applicant.
  if (existing && (existing.phase === "analysed" || existing.phase === "conversing")) {
    return { error: "Ruby is already screening this applicant — please wait for it to finish." };
  }

  // Find an applicable Ruby step (for its selected forms + CV choice).
  const { data: stepsRaw } = await admin
    .from("onboarding_templates")
    .select("ruby_form_ids, ruby_include_cv, role_ids, ruby_focus, ruby_instructions, ruby_question_count, ruby_document_ids, ruby_upload_kinds")
    .eq("company_id", current.company_id)
    .eq("is_store", false)
    .eq("task_type", "ruby");
  const steps = (stepsRaw ?? []) as {
    ruby_form_ids: string[] | null;
    ruby_include_cv: boolean | null;
    role_ids: string[] | null;
    ruby_focus: string[] | null;
    ruby_instructions: string | null;
    ruby_question_count: number | null;
    ruby_document_ids: string[] | null;
    ruby_upload_kinds: string[] | null;
  }[];
  const roleId = app.jobs?.role_id ?? null;
  const step = steps.find((s) => !s.role_ids || s.role_ids.length === 0 || (!!roleId && s.role_ids.includes(roleId))) ?? null;

  // If a step restricts the forms, review only those; else review everything.
  const onlyFormIds = step && (step.ruby_form_ids ?? []).length > 0 ? (step.ruby_form_ids as string[]) : undefined;
  // Include the CV when the step says so, or (no step) by default if present.
  const includeCv = step ? step.ruby_include_cv === true : true;

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
  const attachments = await gatherRubyUploads(admin, app.id, step?.ruby_upload_kinds);
  if (!answersText && !cvBase64Pdf && attachments.length === 0) {
    return { error: "Nothing to review yet — the applicant hasn't submitted a form, CV or upload." };
  }
  const name = [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ").trim() || "the candidate";

  const cfg = await loadRubyRuntimeConfig(current.company_id, step);
  let analysis: { summary: string[]; concerns: string[]; questions: { question: string; rationale: string }[] };
  try {
    analysis = await generateRubyAnalysis({
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
      attachments,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ruby couldn't analyse the application." };
  }

  const report: RubyReportData = { summary: analysis.summary, concerns: analysis.concerns, questions: analysis.questions };
  await admin.from("ruby_reports").upsert(
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
  // Ruby is billed per applicant (40 included/month, then 75p), NOT via the 10p
  // AI meter. One credit per applicant, deduped by application_id.
  await recordRubyApplicant(current.company_id, app.id);
  // Only start the screening conversation (consent message + nudge SMS) on the
  // FIRST run — a re-run must never re-contact the applicant.
  if (!existing) {
    await startRubyConversation(admin, app.id);
  }
  return { ok: true };
}

/** Founder: turn the Ruby entitlement on/off for a company. */
export async function setCompanyRubyEnabled(companyId: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  await createAdminClient().from("companies").update({ ruby_enabled: enabled }).eq("id", companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
}

const cleanAttrList = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 120)))].slice(0, 100)
    : [];

/** Save the tuning half of Ruby Settings (focus / instructions / question count
 *  / follow-ups). Merges over the saved config so the Attributes screen's data
 *  is preserved. Admin-only. */
export async function saveRubySettings(
  input: { focus?: string[]; instructions?: string; questionCount?: number; followUps?: boolean }
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change Ruby settings." };

  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("ruby_enabled, settings").eq("id", current.company_id).single();
  if (co?.ruby_enabled !== true) return { error: "Ruby isn't enabled for this company." };

  const existing = readRubyConfig(co.settings);
  const merged: RubyConfig = {
    ...existing,
    focus: Array.isArray(input.focus) ? input.focus.filter((x) => typeof x === "string").slice(0, 20) : existing.focus,
    instructions: typeof input.instructions === "string" ? input.instructions.slice(0, 2000) : existing.instructions,
    questionCount: Math.min(20, Math.max(1, Math.round(Number(input.questionCount) || 8))),
    followUps: input.followUps === true,
  };

  const settings = { ...(co.settings && typeof co.settings === "object" ? (co.settings as Record<string, unknown>) : {}), ruby: merged };
  const { error } = await admin.from("companies").update({ settings }).eq("id", current.company_id);
  if (error) return { error: "Couldn't save Ruby settings." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Save the company's Ruby Attributes (its own Settings screen): the master
 *  on/off switch plus the professional & personal required/desired lists.
 *  Merges over the saved config so the tuning half is preserved. Admin-only. */
export async function saveRubyAttributes(
  input: { enabled: boolean; professional: RubyAttrGroup; personal: RubyAttrGroup }
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change Ruby settings." };

  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("ruby_enabled, settings").eq("id", current.company_id).single();
  if (co?.ruby_enabled !== true) return { error: "Ruby isn't enabled for this company." };

  const group = (g: RubyAttrGroup | undefined): RubyAttrGroup => ({
    required: cleanAttrList(g?.required),
    desired: cleanAttrList(g?.desired),
    custom: cleanAttrList(g?.custom),
  });

  const existing = readRubyConfig(co.settings);
  const merged: RubyConfig = {
    ...existing,
    attributesEnabled: input.enabled === true,
    professional: group(input.professional),
    personal: group(input.personal),
  };

  const settings = { ...(co.settings && typeof co.settings === "object" ? (co.settings as Record<string, unknown>) : {}), ruby: merged };
  const { error } = await admin.from("companies").update({ settings }).eq("id", current.company_id);
  if (error) return { error: "Couldn't save Ruby attributes." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Load the company's saved Ruby config for the Settings form. */
export async function getRubySettings(): Promise<RubyConfig> {
  const { current } = await requireCompany();
  const { data: co } = await createAdminClient().from("companies").select("settings").eq("id", current.company_id).single();
  return readRubyConfig(co?.settings);
}

/** Force a fresh generation (Regenerate button). Re-meters as an AI action. */
export async function regenerateInterviewQuestions(applicationId: string): Promise<InterviewQuestionsResult> {
  const { user, current } = await requireCompany();

  const { data: company } = await createAdminClient()
    .from("companies")
    .select("ruby_enabled")
    .eq("id", current.company_id)
    .single();
  if (company?.ruby_enabled !== true) return { entitled: false, status: "not_entitled" };

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
