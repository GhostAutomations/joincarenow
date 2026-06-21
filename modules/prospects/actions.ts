"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/modules/auth/queries";

export type ProspectState = { error?: string; ok?: boolean } | undefined;

export const STAGES = ["new", "contacted", "engaged", "demo", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  demo: "Demo booked",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

async function logActivity(
  supabase: Awaited<ReturnType<typeof requirePlatformAdmin>>["supabase"],
  companyId: string,
  actorId: string,
  type: string,
  fields: Record<string, unknown> = {}
) {
  await supabase.from("prospect_activities").insert({
    prospect_company_id: companyId,
    type,
    actor_id: actorId,
    ...fields,
  });
}

/** Quick-add: company name + (optional) one contact email. */
export async function createProspect(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase, user } = await requirePlatformAdmin();
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Enter a company name." };

  const { data: company, error } = await supabase
    .from("prospect_companies")
    .insert({
      name,
      setting_type: formData.get("setting_type")?.toString() || null,
      region: formData.get("region")?.toString() || null,
      website: formData.get("website")?.toString() || null,
      source: formData.get("source")?.toString() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !company) return { error: "Could not add the prospect. Please try again." };

  const email = (formData.get("email")?.toString() ?? "").trim();
  const contactName = (formData.get("contact_name")?.toString() ?? "").trim();
  if (email || contactName) {
    await supabase.from("prospect_contacts").insert({
      prospect_company_id: company.id,
      name: contactName || null,
      email: email || null,
      role: formData.get("role")?.toString() || null,
    });
  }
  await logActivity(supabase, company.id as string, user.id, "system", { body: "Prospect created" });

  revalidatePath("/admin/sales");
  redirect(`/admin/sales/${company.id}`);
}

/** Move a prospect to a new stage (logged to the timeline). */
export async function updateStage(formData: FormData): Promise<void> {
  const { supabase, user } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  const stage = formData.get("stage")?.toString();
  if (!id || !stage || !STAGES.includes(stage as Stage)) return;

  const { data: before } = await supabase
    .from("prospect_companies").select("stage").eq("id", id).single();
  await supabase.from("prospect_companies").update({ stage, updated_at: new Date().toISOString() }).eq("id", id);
  await logActivity(supabase, id, user.id, "stage_change", {
    body: `${STAGE_LABEL[(before?.stage as Stage) ?? "new"]} → ${STAGE_LABEL[stage as Stage]}`,
    meta: { from: before?.stage, to: stage },
  });

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
}

/** Add a free-text note to the timeline. */
export async function addNote(formData: FormData): Promise<void> {
  const { supabase, user } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!id || body.length < 1) return;
  await logActivity(supabase, id, user.id, "note", { body });
  revalidatePath(`/admin/sales/${id}`);
}

/** Add a contact to a prospect company. */
export async function addContact(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const name = (formData.get("name")?.toString() ?? "").trim();
  const email = (formData.get("email")?.toString() ?? "").trim();
  const phone = (formData.get("phone")?.toString() ?? "").trim();
  if (!name && !email && !phone) return;
  await supabase.from("prospect_contacts").insert({
    prospect_company_id: id,
    name: name || null,
    email: email || null,
    phone: phone || null,
    role: formData.get("role")?.toString() || null,
    consent_basis: formData.get("consent_basis")?.toString() || null,
  });
  revalidatePath(`/admin/sales/${id}`);
}

/** Add a follow-up task. */
export async function addTask(formData: FormData): Promise<void> {
  const { supabase, user } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  const title = (formData.get("title")?.toString() ?? "").trim();
  if (!id || title.length < 2) return;
  await supabase.from("prospect_tasks").insert({
    prospect_company_id: id,
    title,
    due_date: formData.get("due_date")?.toString() || null,
    created_by: user.id,
  });
  revalidatePath(`/admin/sales/${id}`);
}

/** Tick / untick a task. */
export async function toggleTask(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const taskId = formData.get("taskId")?.toString();
  const id = formData.get("id")?.toString();
  const done = formData.get("done") === "true";
  if (!taskId) return;
  await supabase.from("prospect_tasks").update({ done }).eq("id", taskId);
  if (id) revalidatePath(`/admin/sales/${id}`);
}
