"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type WfState = { error?: string; ok?: boolean } | undefined;
export type ApplyState = { error?: string; ok?: boolean; applied?: string } | undefined;

const STAGES = ["on_application", "reviewing", "interview", "offer", "hired"];
const TYPES = ["form", "document", "acknowledge"];

type StepInput = {
  title: string;
  taskType: string;
  formId: string;
  triggerStage: string;
  required: boolean;
  dueDays: string;
  body: string;
};

function validateStep(s: StepInput): string | null {
  if ((s.title ?? "").trim().length < 2) return "Give the step a title.";
  if (!TYPES.includes(s.taskType)) return "Pick a step type.";
  if (!STAGES.includes(s.triggerStage)) return "Choose when the step is sent.";
  if (s.taskType === "form" && !s.formId) return "Choose a form for a form step.";
  return null;
}

function stepRow(s: StepInput, base: Record<string, unknown>, position: number) {
  const dueDays = s.dueDays === "" ? null : Math.max(0, parseInt(s.dueDays, 10) || 0);
  return {
    ...base,
    company_id: null,
    is_store: true,
    store_published: false,
    title: s.title.trim(),
    task_type: s.taskType,
    form_id: s.taskType === "form" ? s.formId : null,
    body: (s.body ?? "").trim() || null,
    required: s.required,
    due_days: dueDays,
    trigger_stage: s.triggerStage,
    role_id: null, // role is bound when applied to a company
    position,
  };
}

function readStep(fd: FormData): StepInput {
  return {
    title: String(fd.get("title") ?? ""),
    taskType: String(fd.get("taskType") ?? ""),
    formId: String(fd.get("formId") ?? ""),
    triggerStage: String(fd.get("triggerStage") ?? ""),
    required: fd.get("required") === "on" || fd.get("required") === "true",
    dueDays: String(fd.get("dueDays") ?? ""),
    body: String(fd.get("body") ?? ""),
  };
}

/** Founder: create a new store workflow with its first step. */
export async function createStoreWorkflow(_prev: WfState, formData: FormData): Promise<WfState> {
  const { supabase } = await requirePlatformAdmin();
  const name = String(formData.get("workflowName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  if (name.length < 2) return { error: "Give the workflow a name." };

  const step = readStep(formData);
  const stepErr = validateStep(step);
  if (stepErr) return { error: stepErr };

  const workflowId = crypto.randomUUID();
  const row = stepRow(
    step,
    {
      workflow_id: workflowId,
      workflow_name: name,
      store_category: category,
      store_description: description,
    },
    0
  );
  const { error } = await supabase.from("onboarding_templates").insert(row);
  if (error) return { error: `Could not create: ${error.message}` };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: append a step to an existing store workflow. */
export async function addStoreWorkflowStep(_prev: WfState, formData: FormData): Promise<WfState> {
  const { supabase } = await requirePlatformAdmin();
  const workflowId = String(formData.get("workflowId") ?? "");
  if (!workflowId) return { error: "Missing workflow." };
  const step = readStep(formData);
  const stepErr = validateStep(step);
  if (stepErr) return { error: stepErr };

  // Carry the workflow's name/category/description + next position from a sibling row.
  const { data: siblings } = await supabase
    .from("onboarding_templates")
    .select("workflow_name, store_category, store_description, position")
    .eq("is_store", true)
    .eq("workflow_id", workflowId)
    .order("position", { ascending: false });
  if (!siblings || siblings.length === 0) return { error: "Workflow not found." };
  const head = siblings[0] as { workflow_name: string; store_category: string | null; store_description: string | null; position: number };

  const row = stepRow(
    step,
    {
      workflow_id: workflowId,
      workflow_name: head.workflow_name,
      store_category: head.store_category,
      store_description: head.store_description,
    },
    (head.position ?? -1) + 1
  );
  const { error } = await supabase.from("onboarding_templates").insert(row);
  if (error) return { error: `Could not add step: ${error.message}` };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: delete one step. */
export async function deleteStoreWorkflowStep(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = String(formData.get("stepId") ?? "");
  if (id) {
    await supabase.from("onboarding_templates").delete().eq("id", id).eq("is_store", true);
    revalidatePath("/founder/workflows");
  }
}

/** Founder: delete a whole workflow (all its steps). */
export async function deleteStoreWorkflow(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const workflowId = String(formData.get("workflowId") ?? "");
  if (workflowId) {
    await supabase.from("onboarding_templates").delete().eq("workflow_id", workflowId).eq("is_store", true);
    revalidatePath("/founder/workflows");
  }
}

/** Founder: copy a published store workflow into a company, bound to a role.
 *  Deep-copies any store forms the steps use (decoupled, source_form_id set) and
 *  creates the company's own onboarding_templates. The company owns the copy.
 *  Idempotent: skips if the company already has this workflow for that role. */
export async function applyStoreWorkflow(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const roleId = String(formData.get("roleId") ?? "") || null;
  if (!companyId || !workflowId) return { error: "Missing company or workflow." };

  const db = createAdminClient();

  // 1. Load the store workflow steps.
  const { data: steps } = await db
    .from("onboarding_templates")
    .select("title, task_type, form_id, body, required, due_days, trigger_stage, position, workflow_name")
    .eq("is_store", true)
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (!steps || steps.length === 0) return { error: "Workflow not found." };
  const workflowName = String((steps[0] as { workflow_name: string }).workflow_name);

  // 2. Idempotency — already applied for this role?
  const { data: existing } = await db
    .from("onboarding_templates")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_store", false)
    .eq("workflow_name", workflowName)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, applied: `"${workflowName}" is already on this company.` };
  }

  // 3. Copy any referenced store forms into the company (reuse if already copied).
  const storeFormIds = [...new Set(steps.map((s) => (s as { form_id: string | null }).form_id).filter(Boolean) as string[])];
  const formMap = new Map<string, string>();
  for (const storeFormId of storeFormIds) {
    const { data: alreadyCopied } = await db
      .from("forms")
      .select("id")
      .eq("company_id", companyId)
      .eq("source_form_id", storeFormId)
      .limit(1)
      .maybeSingle();
    if (alreadyCopied) {
      formMap.set(storeFormId, String(alreadyCopied.id));
      continue;
    }
    const { data: storeForm } = await db
      .from("forms")
      .select("name, description, style, category")
      .eq("id", storeFormId)
      .eq("is_store", true)
      .single();
    if (!storeForm) continue;
    const { data: copy } = await db
      .from("forms")
      .insert({
        company_id: companyId,
        name: (storeForm as { name: string }).name,
        description: (storeForm as { description: string | null }).description,
        style: (storeForm as { style: unknown }).style ?? {},
        category: (storeForm as { category: string | null }).category,
        is_store: false,
        source_form_id: storeFormId,
        created_by: null,
      })
      .select("id")
      .single();
    if (!copy) continue;
    const newFormId = String(copy.id);
    formMap.set(storeFormId, newFormId);
    const { data: fields } = await db
      .from("form_fields")
      .select("label, field_type, required, options, help_text, config, position")
      .eq("form_id", storeFormId)
      .order("position", { ascending: true });
    if (fields && fields.length) {
      await db.from("form_fields").insert(fields.map((f) => ({ ...f, form_id: newFormId })));
    }
  }

  // 4. Insert the company's own workflow rows.
  const newWorkflowId = crypto.randomUUID();
  const { data: last } = await db
    .from("onboarding_templates")
    .select("position")
    .eq("company_id", companyId)
    .eq("is_store", false)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = ((last as { position: number } | null)?.position ?? -1) + 1;

  const rows = steps.map((s) => {
    const step = s as {
      title: string; task_type: string; form_id: string | null; body: string | null;
      required: boolean; due_days: number | null; trigger_stage: string | null;
    };
    return {
      company_id: companyId,
      is_store: false,
      title: step.title,
      task_type: step.task_type,
      form_id: step.form_id ? formMap.get(step.form_id) ?? null : null,
      body: step.body,
      required: step.required,
      due_days: step.due_days,
      trigger_stage: step.trigger_stage,
      role_id: roleId,
      workflow_id: newWorkflowId,
      workflow_name: workflowName,
      position: pos++,
    };
  });
  const { error: insErr } = await db.from("onboarding_templates").insert(rows);
  if (insErr) return { error: `Could not apply: ${insErr.message}` };

  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true, applied: `Applied "${workflowName}".` };
}

/** Founder: publish / unpublish a workflow (controls visibility in company setup). */
export async function setStoreWorkflowPublished(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const workflowId = String(formData.get("workflowId") ?? "");
  const publish = String(formData.get("publish") ?? "") === "true";
  if (workflowId) {
    await supabase
      .from("onboarding_templates")
      .update({ store_published: publish })
      .eq("workflow_id", workflowId)
      .eq("is_store", true);
    revalidatePath("/founder/workflows");
  }
}
