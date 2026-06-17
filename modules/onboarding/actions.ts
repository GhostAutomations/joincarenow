"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnbState = { error?: string; ok?: boolean } | undefined;

export type TaskDraft = {
  title: string;
  taskType: string;
  formIds: string[];
  dueDays: string;
  required: boolean;
  body: string;
  triggerStage: string;
  roleId: string;
};

/** Add one or more workflow tasks at once. Each form task expands to one task
 *  per selected form. */
export async function addTemplateTasks(
  drafts: TaskDraft[]
): Promise<{ ok?: boolean; error?: string }> {
  if (!Array.isArray(drafts) || drafts.length === 0) return { error: "Nothing to add" };

  for (const d of drafts) {
    if ((d.title ?? "").trim().length < 2) return { error: "Give each task a title" };
    if (!["form", "document", "acknowledge"].includes(d.taskType)) {
      return { error: "Pick a type for each task" };
    }
    if (!["on_application", "reviewing", "interview", "offer", "hired"].includes(d.triggerStage)) {
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
  const workflowName = (drafts[0]?.title ?? "Workflow").trim();

  const rows: Record<string, unknown>[] = [];
  for (const d of drafts) {
    const dueDays = d.dueDays === "" ? null : Math.max(0, parseInt(d.dueDays, 10) || 0);
    const body = (d.body ?? "").trim() || null;
    const roleId = d.roleId || null;
    if (d.taskType === "form") {
      for (const fid of d.formIds) {
        rows.push({
          company_id: current.company_id,
          title: names.get(fid) ?? d.title.trim(),
          task_type: "form",
          form_id: fid,
          body,
          required: d.required,
          due_days: dueDays,
          trigger_stage: d.triggerStage,
          role_id: roleId,
          workflow_id: workflowId,
          workflow_name: workflowName,
          position: pos++,
        });
      }
    } else {
      rows.push({
        company_id: current.company_id,
        title: d.title.trim(),
        task_type: d.taskType,
        form_id: null,
        body,
        required: d.required,
        due_days: dueDays,
        trigger_stage: d.triggerStage,
        role_id: roleId,
        workflow_id: workflowId,
        workflow_name: workflowName,
        position: pos++,
      });
    }
  }

  const { error } = await supabase.from("onboarding_templates").insert(rows);
  if (error) return { error: `Could not save: ${error.message}` };
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
  formId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requireCompany();
  const { error } = await supabase.rpc("send_adhoc_form", {
    p_application_id: applicationId,
    p_form_id: formId,
  });
  if (error) {
    return { error: error.message || "Could not send the form. Please try again." };
  }
  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  return { ok: true };
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
