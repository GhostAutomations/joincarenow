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

/** Founder: copy a published store workflow into a company, bound to a role.
 *  Deep-copies any store forms the steps use (decoupled, source_form_id set) and
 *  creates the company's own onboarding_templates. The company owns the copy.
 *  Idempotent: skips if the company already has this workflow. */
export async function applyStoreWorkflow(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "");
  const roleId = String(formData.get("roleId") ?? "") || null;
  if (!companyId || !workflowId) return { error: "Missing company or workflow." };

  const db = createAdminClient();

  const { data: steps } = await db
    .from("onboarding_templates")
    .select("title, task_type, form_id, body, required, due_days, trigger_stage, position, workflow_name")
    .eq("is_store", true)
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (!steps || steps.length === 0) return { error: "Workflow not found." };
  const workflowName = String((steps[0] as { workflow_name: string }).workflow_name);

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
