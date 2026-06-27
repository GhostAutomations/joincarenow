"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskDraft } from "@/modules/onboarding/actions";

export type ApplyState = { error?: string; ok?: boolean; applied?: string } | undefined;

const STAGES = ["on_application", "reviewing", "interview", "offer", "hired"];

/** Founder: save one or more store-workflow tasks (same builder as the company
 *  workflow board, in store mode). Store rows have company_id NULL, is_store
 *  true, are draft until published, and are role-agnostic (role bound on apply). */
export async function addStoreWorkflowTasks(
  drafts: TaskDraft[]
): Promise<{ ok?: boolean; error?: string }> {
  if (!Array.isArray(drafts) || drafts.length === 0) return { error: "Nothing to add" };
  for (const d of drafts) {
    if ((d.title ?? "").trim().length < 2) return { error: "Give the workflow a title" };
    if (!["form", "document", "acknowledge"].includes(d.taskType)) return { error: "Pick a type for each task" };
    if (!STAGES.includes(d.triggerStage)) return { error: "Choose when to send each task" };
    if (d.taskType === "form" && (!d.formIds || d.formIds.length === 0)) {
      return { error: "Choose at least one form for each form task" };
    }
  }

  const { supabase } = await requirePlatformAdmin();

  const { data: last } = await supabase
    .from("onboarding_templates")
    .select("position")
    .eq("is_store", true)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = ((last as { position: number } | null)?.position ?? -1) + 1;

  // Resolve store form names (to title each form task).
  const allFormIds = [...new Set(drafts.flatMap((d) => d.formIds ?? []))];
  let names = new Map<string, string>();
  if (allFormIds.length) {
    const { data: fs } = await supabase
      .from("forms")
      .select("id, name")
      .in("id", allFormIds)
      .eq("is_store", true);
    names = new Map((fs ?? []).map((f) => [f.id as string, f.name as string]));
  }

  const workflowId = crypto.randomUUID();
  const workflowName = (drafts[0]?.title ?? "Workflow").trim();
  // Workflow-level role association — founder store uses standard role NAMES,
  // mapped to a company's matching roles on apply. Empty = all roles.
  const roleNames = [...new Set((drafts[0]?.roleValues ?? []).filter(Boolean))];
  const role_names = roleNames.length ? roleNames : null;

  const rows: Record<string, unknown>[] = [];
  for (const d of drafts) {
    const dueDays = d.dueDays === "" ? null : Math.max(0, parseInt(d.dueDays, 10) || 0);
    const body = (d.body ?? "").trim() || null;
    const base = {
      company_id: null,
      is_store: true,
      store_published: false,
      body,
      required: d.required,
      due_days: dueDays,
      trigger_stage: d.triggerStage,
      role_id: null,
      role_names,
      workflow_id: workflowId,
      workflow_name: workflowName,
    };
    if (d.taskType === "form") {
      for (const fid of d.formIds) {
        rows.push({ ...base, title: names.get(fid) ?? d.title.trim(), task_type: "form", form_id: fid, position: pos++ });
      }
    } else {
      rows.push({ ...base, title: d.title.trim(), task_type: d.taskType, form_id: null, position: pos++ });
    }
  }

  const { error } = await supabase.from("onboarding_templates").insert(rows);
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: delete one step (field name `id` to match the shared WorkflowCard). */
export async function deleteStoreWorkflowStep(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
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

/** Founder: archive a whole store workflow into a folder. Archived workflows
 *  drop out of the active list AND the company-setup apply picker, so the
 *  founder doesn't pick the wrong one. Decoupled from companies (their copies
 *  are independent), so this never changes a company's workflow. */
export async function archiveStoreWorkflow(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const workflowId = String(formData.get("workflowId") ?? "");
  const folder = String(formData.get("folder") ?? "").trim().slice(0, 80);
  if (!workflowId || folder.length < 1) return;

  await supabase
    .from("onboarding_templates")
    .update({ store_archived: true, store_folder: folder })
    .eq("workflow_id", workflowId)
    .eq("is_store", true);
  revalidatePath("/founder/workflows");
}

/** Founder: restore an archived store workflow back to the active list. */
export async function unarchiveStoreWorkflow(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const workflowId = String(formData.get("workflowId") ?? "");
  if (workflowId) {
    await supabase
      .from("onboarding_templates")
      .update({ store_archived: false, store_folder: null })
      .eq("workflow_id", workflowId)
      .eq("is_store", true);
    revalidatePath("/founder/workflows");
  }
}

export type EditStoreStepInput = {
  id: string;
  title: string;
  taskType: string;
  triggerStage: string;
  dueDays: string;
  required: boolean;
  body: string;
  formId: string;
};

/** Founder: edit a single store-workflow step. */
export async function updateStoreWorkflowStep(input: EditStoreStepInput): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requirePlatformAdmin();
  if (!input?.id) return { error: "Missing step" };
  if (!["form", "document", "acknowledge"].includes(input.taskType)) return { error: "Pick a type" };
  if (!STAGES.includes(input.triggerStage)) return { error: "Choose when to send it" };

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
      .eq("is_store", true)
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
    .eq("is_store", true);
  if (error) return { error: "Could not save the step." };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: rename a whole store workflow. */
export async function renameStoreWorkflow(workflowId: string, name: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requirePlatformAdmin();
  if (!workflowId) return { error: "Missing workflow" };
  if (name.trim().length < 2) return { error: "Give the workflow a name" };
  const { error } = await supabase
    .from("onboarding_templates")
    .update({ workflow_name: name.trim() })
    .eq("workflow_id", workflowId)
    .eq("is_store", true);
  if (error) return { error: "Could not rename." };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: set which standard role names a store workflow applies to. */
export async function setStoreWorkflowRoleNames(workflowId: string, names: string[]): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requirePlatformAdmin();
  if (!workflowId) return { error: "Missing workflow" };
  const clean = [...new Set((names ?? []).map((n) => n.trim()).filter(Boolean))];
  const { error } = await supabase
    .from("onboarding_templates")
    .update({ role_names: clean.length ? clean : null })
    .eq("workflow_id", workflowId)
    .eq("is_store", true);
  if (error) return { error: "Could not update the roles." };
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: reorder steps within a store workflow. `ids` in desired order. */
export async function reorderStoreWorkflowSteps(ids: string[]): Promise<{ ok?: boolean }> {
  const { supabase } = await requirePlatformAdmin();
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  const { data: rows } = await supabase
    .from("onboarding_templates")
    .select("position")
    .in("id", ids)
    .eq("is_store", true)
    .order("position", { ascending: true })
    .limit(1);
  const base = (rows?.[0]?.position as number | undefined) ?? 0;
  await Promise.all(
    ids.map((id, i) =>
      supabase.from("onboarding_templates").update({ position: base + i }).eq("id", id).eq("is_store", true)
    )
  );
  revalidatePath("/founder/workflows");
  return { ok: true };
}

/** Founder: copy a published store workflow into a company, bound to a role.
 *  Deep-copies any store forms the steps use (decoupled, source_form_id set) and
 *  creates the company's own onboarding_templates. The company owns the copy.
 *  Idempotent: skips if the company already has this workflow. */
export async function applyStoreWorkflow(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  // Multi-select: company role UUIDs ticked in the apply panel (optional).
  const panelRoleIds = formData.getAll("roleId").map(String).filter(Boolean);
  if (!companyId || !workflowId) return { error: "Missing company or workflow." };

  const db = createAdminClient();

  const { data: steps } = await db
    .from("onboarding_templates")
    .select("title, task_type, form_id, body, required, due_days, trigger_stage, position, workflow_name, role_names")
    .eq("is_store", true)
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (!steps || steps.length === 0) return { error: "Workflow not found." };
  const workflowName = String((steps[0] as { workflow_name: string }).workflow_name);
  const storeRoleNames = ((steps[0] as { role_names: string[] | null }).role_names) ?? [];

  // Copy referenced store forms into the company (reuse if already copied).
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

  const { data: last } = await db
    .from("onboarding_templates")
    .select("position")
    .eq("company_id", companyId)
    .eq("is_store", false)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = ((last as { position: number } | null)?.position ?? -1) + 1;

  // Resolve which company roles this applies to: the panel's picks, else map the
  // store workflow's standard role names onto this company's matching roles.
  let targetRoleIds = panelRoleIds;
  if (targetRoleIds.length === 0 && storeRoleNames.length > 0) {
    const { data: matched } = await db
      .from("roles")
      .select("id")
      .eq("company_id", companyId)
      .in("name", storeRoleNames);
    targetRoleIds = (matched ?? []).map((r) => String(r.id));
  }
  const role_ids = targetRoleIds.length ? targetRoleIds : null;

  // Idempotent by workflow_name: one copy per company. Re-applying updates the
  // roles it covers rather than creating a duplicate.
  const { data: existing } = await db
    .from("onboarding_templates")
    .select("workflow_id")
    .eq("company_id", companyId)
    .eq("is_store", false)
    .eq("workflow_name", workflowName)
    .limit(1);
  if (existing && existing.length > 0) {
    const existingWf = String((existing[0] as { workflow_id: string }).workflow_id);
    await db
      .from("onboarding_templates")
      .update({ role_ids, role_id: null })
      .eq("company_id", companyId)
      .eq("is_store", false)
      .eq("workflow_id", existingWf);
    revalidatePath(`/founder/companies/${companyId}`);
    return { ok: true, applied: `Updated "${workflowName}" roles.` };
  }

  const newWorkflowId = crypto.randomUUID();
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
      role_id: null,
      role_ids,
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
