"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnbState = { error?: string; ok?: boolean } | undefined;

// ---------- Staff: manage the checklist template ----------
export async function addTemplateTask(
  _prev: OnbState,
  formData: FormData
): Promise<OnbState> {
  const title = (formData.get("title")?.toString() ?? "").trim();
  const taskType = formData.get("taskType")?.toString() ?? "";
  const formId = formData.get("formId")?.toString() || null;
  const body = (formData.get("body")?.toString() ?? "").trim() || null;
  const required = formData.get("required") === "on";
  const dueDate = formData.get("dueDate")?.toString() || null;
  const triggerStage = formData.get("triggerStage")?.toString() || "";

  if (title.length < 2) return { error: "Give the task a title" };
  if (!["form", "document", "acknowledge"].includes(taskType)) {
    return { error: "Pick a task type" };
  }
  if (!["on_application", "reviewing", "interview", "offer", "hired"].includes(triggerStage)) {
    return { error: "Pick when to send this" };
  }
  if (taskType === "form" && !formId) return { error: "Choose which form to attach" };

  const { supabase, current } = await requireCompany();
  const { data: last } = await supabase
    .from("onboarding_templates")
    .select("position")
    .eq("company_id", current.company_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("onboarding_templates").insert({
    company_id: current.company_id,
    title,
    task_type: taskType,
    form_id: taskType === "form" ? formId : null,
    body,
    required,
    due_date: dueDate,
    trigger_stage: triggerStage,
    position: (last?.position ?? -1) + 1,
  });
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
