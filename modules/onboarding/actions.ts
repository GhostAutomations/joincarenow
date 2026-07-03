"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { normPoppyCount } from "@/lib/poppy/config";
import { notifyApplicant } from "@/modules/comms/actions";

export type OnbState = { error?: string; ok?: boolean } | undefined;

export type TaskDraft = {
  title: string;
  taskType: string;
  formIds: string[];
  dueDays: string;
  required: boolean;
  body: string;
  triggerStage: string;
  /** Workflow-level role association. Company: role UUIDs. Founder store:
   *  standard role names. Empty = applies to all roles. */
  roleValues: string[];
  /** Poppy step only: when it engages (all_forms | as_forms | stage), which
   *  company form ids it reviews, and whether it also reviews the CV. */
  poppyEngage?: string;
  poppyFormIds?: string[];
  poppyIncludeCv?: boolean;
  /** Poppy step overrides of the company-default tuning (empty = use default). */
  poppyFocus?: string[];
  poppyInstructions?: string;
  poppyQuestionCount?: number | string;
  /** Documents (policy/contract ids) Poppy compares against for this step. */
  poppyDocumentIds?: string[];
  /** Uploaded document kinds (e.g. 'dbs') Poppy should review for this step. */
  poppyUploadKinds?: string[];
  /** For a document-upload task: the standard upload kind requested (e.g. 'dbs'). */
  docKind?: string;
  /** The workflow's own name, decoupled from a task's own title so the
   *  drag-built builder can give each task its own title (e.g. the document
   *  name) while all tasks share one workflow name. Falls back to `title`. */
  workflowTitle?: string;
  /** A read-&-sign task links a specific contract/policy the applicant signs. */
  documentId?: string;
  documentKind?: "contract" | "policy";
};

// Right to work is a real pipeline stage the applicant reaches, so tasks can
// trigger there too (application stage-changes fire create_stage_tasks for it).
const WORKFLOW_STAGES = ["on_application", "reviewing", "interview", "right_to_work", "offer", "hired"];

/** Build onboarding_templates rows from task drafts, attaching them to a
 *  workflow (id + name + roles) from `startPos`. Shared by create + append so
 *  the two paths never drift. `formNames` disambiguates a form task's title. */
function buildTemplateRows(opts: {
  companyId: string;
  drafts: TaskDraft[];
  workflowId: string;
  workflowName: string;
  role_ids: string[] | null;
  startPos: number;
  formNames: Map<string, string>;
}): Record<string, unknown>[] {
  const { companyId, drafts, workflowId, workflowName, role_ids, formNames } = opts;
  let pos = opts.startPos;
  const rows: Record<string, unknown>[] = [];
  for (const d of drafts) {
    const dueDays = d.dueDays === "" ? null : Math.max(0, parseInt(d.dueDays, 10) || 0);
    const body = (d.body ?? "").trim() || null;
    const shared = { company_id: companyId, body, role_id: null, role_ids, workflow_id: workflowId, workflow_name: workflowName };
    if (d.taskType === "poppy") {
      rows.push({
        ...shared,
        title: d.title.trim() || "Poppy screening",
        task_type: "poppy",
        form_id: null,
        required: d.required,
        due_days: dueDays,
        // Poppy uses poppy_engage; trigger_stage is inert unless engage='stage'.
        // trigger_stage is NOT NULL, so use a harmless valid default otherwise.
        trigger_stage: d.poppyEngage === "stage" ? d.triggerStage : "on_application",
        poppy_engage: d.poppyEngage,
        poppy_form_ids: d.poppyFormIds ?? [],
        poppy_include_cv: d.poppyIncludeCv === true,
        poppy_focus: d.poppyFocus?.length ? d.poppyFocus : null,
        poppy_instructions: d.poppyInstructions?.trim() || null,
        poppy_question_count: normPoppyCount(d.poppyQuestionCount),
        poppy_document_ids: d.poppyDocumentIds?.length ? d.poppyDocumentIds : null,
        poppy_upload_kinds: d.poppyUploadKinds?.length ? d.poppyUploadKinds : null,
        position: pos++,
      });
    } else if (d.taskType === "form") {
      for (const fid of d.formIds) {
        rows.push({
          ...shared,
          title: formNames.get(fid) ?? d.title.trim(),
          task_type: "form",
          form_id: fid,
          required: d.required,
          due_days: dueDays,
          trigger_stage: d.triggerStage,
          position: pos++,
        });
      }
    } else {
      rows.push({
        ...shared,
        title: d.title.trim(),
        task_type: d.taskType,
        form_id: null,
        required: d.required,
        due_days: dueDays,
        trigger_stage: d.triggerStage,
        // Read-&-sign: link the specific contract/policy the applicant signs.
        document_id: d.documentId ?? null,
        document_kind: d.documentKind ?? null,
        // Document-upload task: the standard upload kind requested (e.g. 'dbs').
        doc_kind: d.docKind ?? null,
        position: pos++,
      });
    }
  }
  return rows;
}

/** Add one or more workflow tasks at once. Each form task expands to one task
 *  per selected form. */
export async function addTemplateTasks(
  drafts: TaskDraft[]
): Promise<{ ok?: boolean; error?: string }> {
  if (!Array.isArray(drafts) || drafts.length === 0) return { error: "Nothing to add" };

  const STAGES = ["on_application", "reviewing", "interview", "right_to_work", "offer", "hired"];
  for (const d of drafts) {
    if ((d.title ?? "").trim().length < 2) return { error: "Give each task a title" };
    if (!["form", "document", "acknowledge", "poppy"].includes(d.taskType)) {
      return { error: "Pick a type for each task" };
    }
    if (d.taskType === "poppy") {
      if (!["all_forms", "as_forms", "stage"].includes(d.poppyEngage ?? "")) {
        return { error: "Choose when Poppy should engage" };
      }
      // Poppy can also engage at Right to work (a real pipeline stage the legacy
      // workflow trigger list doesn't include).
      if (d.poppyEngage === "stage" && ![...STAGES, "right_to_work"].includes(d.triggerStage)) {
        return { error: "Choose which stage Poppy engages at" };
      }
      if ((!d.poppyFormIds || d.poppyFormIds.length === 0) && !d.poppyIncludeCv && (!d.poppyUploadKinds || d.poppyUploadKinds.length === 0)) {
        return { error: "Give Poppy at least one form, upload or the CV to review" };
      }
      continue;
    }
    if (!STAGES.includes(d.triggerStage)) {
      return { error: "Choose when to send each task" };
    }
    if (d.taskType === "form" && (!d.formIds || d.formIds.length === 0)) {
      return { error: "Choose at least one form for each form task" };
    }
  }

  const { supabase, current } = await requireCompany();
  const { data: last } = await supabase
    .from("onboarding_templates")
    .select("position")
    .eq("company_id", current.company_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (last?.position ?? -1) + 1;

  // Resolve form names (to disambiguate when a task has several forms).
  const allFormIds = [...new Set(drafts.flatMap((d) => d.formIds ?? []))];
  let names = new Map<string, string>();
  if (allFormIds.length) {
    const { data: fs } = await supabase
      .from("forms")
      .select("id, name")
      .in("id", allFormIds)
      .eq("company_id", current.company_id);
    names = new Map((fs ?? []).map((f) => [f.id as string, f.name as string]));
  }

  // One workflow id/name shared by every task created in this submission.
  const workflowId = crypto.randomUUID();
  const workflowName = (drafts[0]?.workflowTitle ?? drafts[0]?.title ?? "Workflow").trim();
  // Workflow-level role association (company role UUIDs). Empty = all roles.
  const roleIds = [...new Set((drafts[0]?.roleValues ?? []).filter(Boolean))];
  const role_ids = roleIds.length ? roleIds : null;

  const rows = buildTemplateRows({
    companyId: current.company_id,
    drafts,
    workflowId,
    workflowName,
    role_ids,
    startPos: pos,
    formNames: names,
  });

  const { error } = await supabase.from("onboarding_templates").insert(rows);
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath("/onboarding-board");
  return { ok: true };
}

/** Append one or more tasks to an EXISTING company workflow — same workflow_id,
 *  name and roles — so a workflow can be added to rather than recreated. */
export async function addTasksToWorkflow(
  workflowId: string,
  drafts: TaskDraft[]
): Promise<{ ok?: boolean; error?: string }> {
  if (!workflowId || !Array.isArray(drafts) || drafts.length === 0) return { error: "Nothing to add" };
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can edit workflows." };

  for (const d of drafts) {
    if (!["form", "document", "acknowledge", "poppy"].includes(d.taskType)) return { error: "Pick a type for each task" };
    if (d.taskType === "poppy") {
      if (!["all_forms", "as_forms", "stage"].includes(d.poppyEngage ?? "")) return { error: "Choose when Poppy should engage" };
      if (d.poppyEngage === "stage" && ![...WORKFLOW_STAGES, "right_to_work"].includes(d.triggerStage)) return { error: "Choose which stage Poppy engages at" };
      if ((!d.poppyFormIds || d.poppyFormIds.length === 0) && !d.poppyIncludeCv && (!d.poppyUploadKinds || d.poppyUploadKinds.length === 0)) return { error: "Give Poppy at least one form, upload or the CV to review" };
    } else if (d.taskType === "form" && (!d.formIds || d.formIds.length === 0)) {
      return { error: "Choose at least one form for each form task" };
    } else if (d.taskType !== "poppy" && !WORKFLOW_STAGES.includes(d.triggerStage)) {
      return { error: "Choose when to send each task" };
    }
  }

  // Existing workflow's name + roles + current max position.
  const { data: existing } = await supabase
    .from("onboarding_templates")
    .select("workflow_name, role_ids, position")
    .eq("company_id", current.company_id)
    .eq("workflow_id", workflowId)
    .order("position", { ascending: false });
  if (!existing || existing.length === 0) return { error: "Workflow not found." };
  const workflowName = (existing[0].workflow_name as string) ?? "Workflow";
  const role_ids = (existing[0].role_ids as string[] | null) ?? null;
  const startPos = ((existing[0].position as number) ?? -1) + 1;

  const allFormIds = [...new Set(drafts.flatMap((d) => d.formIds ?? []))];
  let names = new Map<string, string>();
  if (allFormIds.length) {
    const { data: fs } = await supabase.from("forms").select("id, name").in("id", allFormIds).eq("company_id", current.company_id);
    names = new Map((fs ?? []).map((f) => [f.id as string, f.name as string]));
  }

  const rows = buildTemplateRows({ companyId: current.company_id, drafts, workflowId, workflowName, role_ids, startPos, formNames: names });
  const { error } = await supabase.from("onboarding_templates").insert(rows);
  if (error) return { error: `Could not add: ${error.message}` };
  revalidatePath("/onboarding-board");
  return { ok: true };
}

// ---------- Staff: manage the checklist template ----------
export async function addTemplateTask(
  _prev: OnbState,
  formData: FormData
): Promise<OnbState> {
  const title = (formData.get("title")?.toString() ?? "").trim();
  const taskType = formData.get("taskType")?.toString() ?? "";
  const formIds = formData.getAll("formId").map((v) => v.toString()).filter(Boolean);
  const body = (formData.get("body")?.toString() ?? "").trim() || null;
  const required = formData.get("required") === "on";
  const dueDaysRaw = formData.get("dueDays")?.toString() ?? "";
  const dueDays = dueDaysRaw === "" ? null : Math.max(0, parseInt(dueDaysRaw, 10) || 0);
  const triggerStage = formData.get("triggerStage")?.toString() || "";

  if (title.length < 2) return { error: "Give the workflow a title" };
  if (!["form", "document", "acknowledge"].includes(taskType)) {
    return { error: "Pick a task type" };
  }
  if (!["on_application", "reviewing", "interview", "offer", "hired"].includes(triggerStage)) {
    return { error: "Pick when to send this" };
  }
  if (taskType === "form" && formIds.length === 0) {
    return { error: "Choose at least one form to attach" };
  }

  const { supabase, current } = await requireCompany();
  const { data: last } = await supabase
    .from("onboarding_templates")
    .select("position")
    .eq("company_id", current.company_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (last?.position ?? -1) + 1;

  // For a form task, create one checklist item per selected form (so the
  // applicant gets each as its own task). Other types create a single item.
  let rows: Record<string, unknown>[];
  if (taskType === "form") {
    let names = new Map<string, string>();
    if (formIds.length > 1) {
      const { data: fs } = await supabase
        .from("forms")
        .select("id, name")
        .in("id", formIds)
        .eq("company_id", current.company_id);
      names = new Map((fs ?? []).map((f) => [f.id as string, f.name as string]));
    }
    rows = formIds.map((fid) => ({
      company_id: current.company_id,
      title: formIds.length > 1 ? `${title} – ${names.get(fid) ?? "Form"}` : title,
      task_type: "form",
      form_id: fid,
      body,
      required,
      due_days: dueDays,
      trigger_stage: triggerStage,
      position: pos++,
    }));
  } else {
    rows = [
      {
        company_id: current.company_id,
        title,
        task_type: taskType,
        form_id: null,
        body,
        required,
        due_days: dueDays,
        trigger_stage: triggerStage,
        position: pos,
      },
    ];
  }

  const { error } = await supabase.from("onboarding_templates").insert(rows);
  if (error) return { error: "Could not add the task." };

  revalidatePath("/onboarding-board");
  return { ok: true };
}

/** Staff: set a new starter's start date (drives before/after due dates). */
export async function setStartDate(formData: FormData) {
  const applicationId = formData.get("applicationId");
  const startDate = formData.get("startDate")?.toString() || null;
  if (typeof applicationId !== "string") return;
  const { supabase, current } = await requireCompany();
  await supabase
    .from("applications")
    .update({ start_date: startDate })
    .eq("id", applicationId)
    .eq("company_id", current.company_id);
  revalidatePath("/onboarding-board");
}

/** Delete every task in a workflow group. */
export async function deleteWorkflow(formData: FormData) {
  const workflowId = formData.get("workflowId");
  if (typeof workflowId !== "string") return;
  const { supabase, current } = await requireCompany();
  await supabase
    .from("onboarding_templates")
    .delete()
    .eq("workflow_id", workflowId)
    .eq("company_id", current.company_id);
  revalidatePath("/onboarding-board");
}

export async function deleteTemplateTask(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const { supabase, current } = await requireCompany();
  await supabase
    .from("onboarding_templates")
    .delete()
    .eq("id", id)
    .eq("company_id", current.company_id);
  revalidatePath("/onboarding-board");
}

export type EditTaskInput = {
  id: string;
  title: string;
  taskType: string;
  triggerStage: string;
  dueDays: string;
  required: boolean;
  body: string;
  formId: string;
  poppyEngage?: string;
  poppyFormIds?: string[];
  poppyIncludeCv?: boolean;
  poppyFocus?: string[];
  poppyInstructions?: string;
  poppyQuestionCount?: number | string;
  poppyDocumentIds?: string[];
  poppyUploadKinds?: string[];
};

const WF_STAGES = ["on_application", "reviewing", "interview", "offer", "hired"];

/** Edit a single workflow task (company-scoped). */
export async function updateTemplateTask(input: EditTaskInput): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, current } = await requireCompany();
  if (!input?.id) return { error: "Missing task" };

  // Poppy step edit.
  if (input.taskType === "poppy") {
    if (!["all_forms", "as_forms", "stage"].includes(input.poppyEngage ?? "")) {
      return { error: "Choose when Poppy should engage" };
    }
    if (input.poppyEngage === "stage" && ![...WF_STAGES, "right_to_work"].includes(input.triggerStage)) {
      return { error: "Choose which stage Poppy engages at" };
    }
    if ((!input.poppyFormIds || input.poppyFormIds.length === 0) && !input.poppyIncludeCv && (!input.poppyUploadKinds || input.poppyUploadKinds.length === 0)) {
      return { error: "Give Poppy at least one form, upload or the CV to review" };
    }
    const { error } = await supabase
      .from("onboarding_templates")
      .update({
        task_type: "poppy",
        poppy_engage: input.poppyEngage,
        poppy_form_ids: input.poppyFormIds ?? [],
        poppy_include_cv: input.poppyIncludeCv === true,
        poppy_focus: input.poppyFocus?.length ? input.poppyFocus : null,
        poppy_instructions: input.poppyInstructions?.trim() || null,
        poppy_question_count: normPoppyCount(input.poppyQuestionCount),
        poppy_document_ids: input.poppyDocumentIds?.length ? input.poppyDocumentIds : null,
        poppy_upload_kinds: input.poppyUploadKinds?.length ? input.poppyUploadKinds : null,
        trigger_stage: input.poppyEngage === "stage" ? input.triggerStage : "on_application",
        body: input.body.trim() || null,
        title: input.title.trim() || "Poppy screening",
        form_id: null,
      })
      .eq("id", input.id)
      .eq("company_id", current.company_id);
    if (error) return { error: "Could not save the step." };
    revalidatePath("/onboarding-board");
    return { ok: true };
  }

  if (!["form", "document", "acknowledge"].includes(input.taskType)) return { error: "Pick a type" };
  if (!WF_STAGES.includes(input.triggerStage)) return { error: "Choose when to send it" };

  const dueDays = input.dueDays.trim() === "" ? null : Math.max(0, parseInt(input.dueDays, 10) || 0);
  const update: Record<string, unknown> = {
    task_type: input.taskType,
    trigger_stage: input.triggerStage,
    required: input.required,
    due_days: dueDays,
    body: input.body.trim() || null,
  };

  if (input.taskType === "form") {
    if (!input.formId) return { error: "Choose a form for this task" };
    const { data: f } = await supabase
      .from("forms")
      .select("name")
      .eq("id", input.formId)
      .eq("company_id", current.company_id)
      .maybeSingle();
    if (!f) return { error: "Form not found" };
    update.form_id = input.formId;
    update.title = (f as { name: string }).name;
  } else {
    if (input.title.trim().length < 2) return { error: "Give the task a title" };
    update.form_id = null;
    update.title = input.title.trim();
  }

  const { error } = await supabase
    .from("onboarding_templates")
    .update(update)
    .eq("id", input.id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not save the task." };
  revalidatePath("/onboarding-board");
  return { ok: true };
}

/** Rename a whole workflow group (company-scoped). */
export async function renameWorkflow(workflowId: string, name: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, current } = await requireCompany();
  if (!workflowId) return { error: "Missing workflow" };
  if (name.trim().length < 2) return { error: "Give the workflow a name" };
  const { error } = await supabase
    .from("onboarding_templates")
    .update({ workflow_name: name.trim() })
    .eq("workflow_id", workflowId)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not rename." };
  revalidatePath("/onboarding-board");
  return { ok: true };
}

/** Reassign which roles a workflow applies to (company-scoped). Empty = all. */
export async function setWorkflowRoles(workflowId: string, roleIds: string[]): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, current } = await requireCompany();
  if (!workflowId) return { error: "Missing workflow" };
  const clean = [...new Set((roleIds ?? []).filter(Boolean))];
  if (clean.length) {
    const { data: valid } = await supabase
      .from("roles")
      .select("id")
      .eq("company_id", current.company_id)
      .in("id", clean);
    if ((valid?.length ?? 0) !== clean.length) return { error: "One or more roles not found" };
  }
  const { error } = await supabase
    .from("onboarding_templates")
    .update({ role_ids: clean.length ? clean : null, role_id: null })
    .eq("workflow_id", workflowId)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not update the roles." };
  revalidatePath("/onboarding-board");
  return { ok: true };
}

/** Reorder tasks within a workflow (company-scoped). `ids` in desired order. */
export async function reorderTemplateTasks(ids: string[]): Promise<{ ok?: boolean }> {
  const { supabase, current } = await requireCompany();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  const { data: rows } = await supabase
    .from("onboarding_templates")
    .select("position")
    .in("id", ids)
    .eq("company_id", current.company_id)
    .order("position", { ascending: true })
    .limit(1);
  const base = (rows?.[0]?.position as number | undefined) ?? 0;
  await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("onboarding_templates")
        .update({ position: base + i })
        .eq("id", id)
        .eq("company_id", current.company_id)
    )
  );
  revalidatePath("/onboarding-board");
  return { ok: true };
}

export type FormReview = {
  title: string;
  status: string;
  fields: {
    id: string;
    label: string;
    field_type: string;
    options: string[];
    config: { text?: string; size?: string; color?: string } | null;
  }[];
  answers: Record<string, string | string[]>;
};

/** Staff: load a form task's fields + the applicant's submitted answers,
 *  for the review modal in the pipeline. */
export async function getFormReview(taskId: string): Promise<FormReview | null> {
  const { supabase } = await requireCompany();
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("title, status, form_id, submission_id")
    .eq("id", taskId)
    .single();
  if (!task?.form_id) return null;

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, options, config, position")
    .eq("form_id", task.form_id)
    .order("position", { ascending: true });

  let answers: Record<string, string | string[]> = {};
  if (task.submission_id) {
    const { data: sub } = await supabase
      .from("form_submissions")
      .select("answers")
      .eq("id", task.submission_id)
      .single();
    answers = (sub?.answers as Record<string, string | string[]>) ?? {};
  }

  return {
    title: task.title,
    status: task.status,
    fields: (fields ?? []).map((f) => ({
      id: f.id as string,
      label: f.label as string,
      field_type: f.field_type as string,
      options: (f.options ?? []) as string[],
      config: (f.config ?? null) as FormReview["fields"][number]["config"],
    })),
    answers,
  };
}

/** Staff: load the applicant's application form (the form they actually filled
 *  at apply time), with fields + answers + review status. Identified as the
 *  submission for this application that isn't tied to a workflow task. */
export async function getApplicationReview(
  applicationId: string
): Promise<(FormReview & { submissionId: string | null }) | null> {
  const { supabase, current } = await requireCompany();

  // The application form is, by definition, the form assigned to the job.
  // Identify it directly (robust), then load that form's submission for this
  // application (the applicant's answers + review status).
  const { data: app } = await supabase
    .from("applications")
    .select("job_id")
    .eq("id", applicationId)
    .eq("company_id", current.company_id)
    .single();
  if (!app?.job_id) return null;
  const { data: job } = await supabase
    .from("jobs")
    .select("application_form_id")
    .eq("id", app.job_id)
    .single();
  const formId = (job as { application_form_id?: string } | null)?.application_form_id ?? undefined;
  if (!formId) return null;

  const { data: sub } = await supabase
    .from("form_submissions")
    .select("id, answers, review_status")
    .eq("application_id", applicationId)
    .eq("form_id", formId)
    .eq("company_id", current.company_id)
    .maybeSingle();

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, options, config, position")
    .eq("form_id", formId)
    .order("position", { ascending: true });

  return {
    title: "Application form",
    status: (sub?.review_status as string) ?? (sub ? "submitted" : "pending"),
    submissionId: (sub?.id as string) ?? null,
    fields: (fields ?? []).map((f) => ({
      id: f.id as string,
      label: f.label as string,
      field_type: f.field_type as string,
      options: (f.options ?? []) as string[],
      config: (f.config ?? null) as FormReview["fields"][number]["config"],
    })),
    answers: (sub?.answers as Record<string, string | string[]>) ?? {},
  };
}

export type FormView = { name: string; items: { label: string; value: string }[] };

/** Read-only view of a form submission's answers (label → value), for the
 *  employee record's Documents → Forms category. */
export async function getFormSubmissionView(submissionId: string): Promise<FormView | null> {
  const { supabase, current } = await requireCompany();
  const { data: sub } = await supabase
    .from("form_submissions")
    .select("answers, form_id, forms(name)")
    .eq("id", submissionId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (!sub) return null;

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, position")
    .eq("form_id", sub.form_id as string)
    .order("position", { ascending: true });

  const answers = (sub.answers as Record<string, unknown>) ?? {};
  const fmt = (v: unknown, type: string): string => {
    if (v == null || v === "") return "—";
    if (type === "signature") return "Signature captured";
    if (type === "file") {
      const path = Array.isArray(v) ? v.join(", ") : String(v);
      return path.split("/").pop() || "File attached";
    }
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  const items = (fields ?? []).map((f) => ({
    label: f.label as string,
    value: fmt(answers[f.id as string], f.field_type as string),
  }));

  return { name: (sub.forms as unknown as { name: string } | null)?.name ?? "Form", items };
}

/** Staff: approve / resend the application form. Goes through a SECURITY
 *  DEFINER RPC so the review persists (RLS blocks a direct update) and so a
 *  resend surfaces the form to the applicant in their portal. */
export async function reviewApplicationForm(formData: FormData) {
  const applicationId = formData.get("applicationId");
  const status = formData.get("status");
  const note = formData.get("note")?.toString() || null;
  if (typeof applicationId !== "string") return;
  if (status !== "approved" && status !== "rejected" && status !== "submitted") return;
  const { supabase } = await requireCompany();
  await supabase.rpc("set_application_form_review", {
    p_application_id: applicationId,
    p_status: status,
    p_note: note,
  });
  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
}

// ---------- Staff: review a submitted task ----------
export async function reviewTask(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  const note = formData.get("note")?.toString() || null;
  if (typeof id !== "string") return;
  if (status !== "approved" && status !== "rejected" && status !== "pending") return;

  const { supabase, user, current } = await requireCompany();
  await supabase
    .from("onboarding_tasks")
    .update({
      status,
      note,
      reviewed_by: user.id,
      completed_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);
  revalidatePath("/onboarding-board");
}

/** Staff: send an ad-hoc form to an applicant from the pipeline. Creates a
 *  form task so it appears in the applicant's portal and behaves like any other
 *  workflow form (review / approve / resend). */
export async function sendAdHocForm(
  applicationId: string,
  formId: string,
  notify?: "email" | "sms" | "both" | null
): Promise<{ ok?: boolean; error?: string; notifyError?: string }> {
  const { supabase } = await requireCompany();
  const { error } = await supabase.rpc("send_adhoc_form", {
    p_application_id: applicationId,
    p_form_id: formId,
  });
  if (error) {
    return { error: error.message || "Could not send the form. Please try again." };
  }

  const channels: ("email" | "sms")[] =
    notify === "both" ? ["email", "sms"] : notify === "email" || notify === "sms" ? [notify] : [];
  let notifyError: string | undefined;
  for (const channel of channels) {
    const res = await notifyApplicant({
      applicationId,
      channel,
      subject: "A form to complete from {{company_name}}",
      body:
        "Hi {{first_name}},\n\n{{company_name}} has sent you a form to complete for the {{job_title}} role. " +
        "Use the button below to log in to your applicant portal and fill it in.\n\nThank you.",
      cta: { label: "Complete the form", url: "{{portal_link}}" },
    });
    if (!res.ok) notifyError = res.error;
  }

  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  return { ok: true, notifyError };
}

/** Staff: ask the applicant to upload a named document (e.g. a DBS certificate).
 *  Creates a required 'document' task in their portal; the upload reuses the
 *  shared set_onboarding_doc path. `docKind` tags it (e.g. 'dbs') so the staff
 *  file / pipeline can recognise it. */
export async function requestDocument(
  applicationId: string,
  docTitle: string,
  message: string,
  docKind?: string | null,
  notify?: "email" | "sms" | "both" | null
): Promise<{ ok?: boolean; error?: string; notifyError?: string }> {
  const title = (docTitle || "").trim() || "Upload a document";
  const { supabase } = await requireCompany();
  const { error } = await supabase.rpc("request_document", {
    p_application_id: applicationId,
    p_title: title,
    p_message: message || null,
    p_doc_kind: docKind || null,
  });
  if (error) return { error: error.message || "Could not request the document. Please try again." };

  const channels: ("email" | "sms")[] =
    notify === "both" ? ["email", "sms"] : notify === "email" || notify === "sms" ? [notify] : [];
  let notifyError: string | undefined;
  if (channels.length) {
    const intro = message.trim()
      ? message.trim() + "\n\n"
      : `{{company_name}} has asked you to upload a document (${title}) for the {{job_title}} role.\n\n`;
    for (const channel of channels) {
      const res = await notifyApplicant({
        applicationId,
        channel,
        subject: `Document needed: ${title} — {{company_name}}`,
        body: `Hi {{first_name}},\n\n${intro}Use the button below to log in to your applicant portal and upload it.\n\nThank you.`,
        cta: { label: "Upload document", url: "{{portal_link}}" },
      });
      if (!res.ok) notifyError = res.error;
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  return { ok: true, notifyError };
}

/** Staff: ask the applicant to upload a CV. Creates a document task in their
 *  portal with an optional message. */
export async function requestCv(
  applicationId: string,
  message: string,
  notify?: "email" | "sms" | "both" | null
): Promise<{ ok?: boolean; error?: string; notifyError?: string }> {
  const { supabase } = await requireCompany();
  const { error } = await supabase.rpc("request_cv", {
    p_application_id: applicationId,
    p_message: message || null,
  });
  if (error) return { error: error.message || "Could not request the CV. Please try again." };

  const channels: ("email" | "sms")[] =
    notify === "both" ? ["email", "sms"] : notify === "email" || notify === "sms" ? [notify] : [];
  let notifyError: string | undefined;
  if (channels.length) {
    const intro = message.trim()
      ? message.trim() + "\n\n"
      : "{{company_name}} has asked you to upload your CV for the {{job_title}} role.\n\n";
    for (const channel of channels) {
      const res = await notifyApplicant({
        applicationId,
        channel,
        subject: "Please upload your CV — {{company_name}}",
        body: `Hi {{first_name}},\n\n${intro}Use the button below to log in to your applicant portal and upload it.\n\nThank you.`,
        cta: { label: "Upload your CV", url: "{{portal_link}}" },
      });
      if (!res.ok) notifyError = res.error;
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  return { ok: true, notifyError };
}

/** Staff: signed URL for an uploaded onboarding document. */
export async function getOnboardingDocUrl(
  taskId: string
): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireCompany();
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("doc_path")
    .eq("id", taskId)
    .single();
  if (!task?.doc_path) return { error: "No document uploaded" };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("applications")
    .createSignedUrl(task.doc_path, 120);
  if (error || !data) return { error: "Could not open the document" };
  return { url: data.signedUrl };
}

// ---------- Applicant: complete tasks ----------
export async function acknowledgeTask(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const { supabase } = await requireUser();
  await supabase.rpc("acknowledge_onboarding", { p_task_id: id });
  revalidatePath("/portal");
}

/** Applicant reads the contract/policy linked to a read-&-sign task. Returns the
 *  merge-filled body (RLS-safe via SECURITY DEFINER RPC, guarded by ownership). */
export async function loadOnboardingDocument(taskId: string): Promise<
  { title: string; body: string; kind: string; alreadySigned: boolean; signatureMethod: "type" | "draw" | "none" }
  | { error: string }
> {
  if (!taskId) return { error: "Missing task" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_onboarding_document", { p_task_id: taskId });
  if (error) return { error: "This document isn't available." };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "This document isn't available." };
  const sm = String(row.signature_method ?? "type");
  return {
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    kind: String(row.kind ?? "policy"),
    alreadySigned: row.already_signed === true,
    signatureMethod: sm === "draw" ? "draw" : sm === "none" ? "none" : "type",
  };
}

/** Applicant confirms they've read a "signature not required" document — marks
 *  the read task complete with no signature captured. */
export async function confirmOnboardingDocument(taskId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!taskId) return { error: "Missing task" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("acknowledge_onboarding", { p_task_id: taskId });
  if (error) return { error: "Could not confirm. Please try again." };
  revalidatePath("/portal");
  return { ok: true };
}

/** Applicant signs the linked document (type name, or a drawn signature image).
 *  Snapshots the exact text into signed_documents and completes the task. */
export async function signOnboardingDocument(
  taskId: string,
  signerName: string,
  signatureImage: string | null
): Promise<{ ok?: boolean; error?: string }> {
  if (!taskId) return { error: "Missing task" };
  const name = (signerName ?? "").trim();
  const drawn = !!signatureImage && signatureImage.trim() !== "";
  if (!drawn && name.length < 2) return { error: "Please type your full name to sign." };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("sign_onboarding_document", {
    p_task_id: taskId,
    p_signer_name: name || "Signature",
    p_signature_image: drawn ? signatureImage : null,
  });
  if (error) return { error: "Could not submit your signature. Please try again." };
  revalidatePath("/portal");
  return { ok: true };
}

export async function uploadOnboardingDoc(
  _prev: OnbState,
  formData: FormData
): Promise<OnbState> {
  const id = formData.get("taskId");
  const file = formData.get("doc");
  if (typeof id !== "string") return { error: "Missing task" };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be 5MB or smaller" };

  const { supabase, user } = await requireUser();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/onboarding-${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from("applications")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { error: "Could not upload. Please try again." };

  const { error } = await supabase.rpc("set_onboarding_doc", { p_task_id: id, p_path: path });
  if (error) return { error: "Could not save." };

  revalidatePath("/portal");
  return { ok: true };
}

/** Applicant submits a professional registration: a number (required) plus,
 *  unless they tick "number only", a photo of their card/certificate. */
export async function submitRegistration(
  _prev: OnbState,
  formData: FormData
): Promise<OnbState> {
  const id = formData.get("taskId");
  const number = (formData.get("reg_number")?.toString() ?? "").trim();
  const noCard = formData.get("no_card") === "on";
  const file = formData.get("doc");
  if (typeof id !== "string") return { error: "Missing task" };
  if (number.length < 2) return { error: "Enter your registration number." };

  const { supabase, user } = await requireUser();

  let path: string | null = null;
  if (!noCard) {
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Upload a photo of your registration, or tick the box if you don't have one." };
    }
    if (file.size > 5 * 1024 * 1024) return { error: "File must be 5MB or smaller" };
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    path = `${user.id}/registration-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from("applications")
      .upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return { error: "Could not upload. Please try again." };
  }

  const { error } = await supabase.rpc("set_onboarding_registration", {
    p_task_id: id,
    p_number: number,
    p_path: path,
  });
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/portal");
  return { ok: true };
}

export async function submitOnboardingForm(
  _prev: OnbState,
  formData: FormData
): Promise<OnbState> {
  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return { error: "Missing task" };

  const { supabase } = await requireUser();
  const answers: Record<string, unknown> = {};
  const keys = new Set<string>();
  for (const k of formData.keys()) if (k.startsWith("field_")) keys.add(k);
  for (const k of keys) {
    const fid = k.slice("field_".length);
    const vals = formData.getAll(k).filter((v): v is string => typeof v === "string" && v !== "");
    if (vals.length === 0) continue;
    answers[fid] = vals.length === 1 ? vals[0] : vals;
  }

  const { error } = await supabase.rpc("submit_onboarding_form", {
    p_task_id: taskId,
    p_answers: answers,
  });
  if (error) return { error: error.message };

  redirect("/portal?onboarded=1");
}
