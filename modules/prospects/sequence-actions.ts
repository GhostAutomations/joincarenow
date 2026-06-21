"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";

export type SeqState = { error?: string; ok?: boolean } | undefined;

/** Create a sequence. */
export async function createSequence(_prev: SeqState, formData: FormData): Promise<SeqState> {
  const { supabase, user } = await requirePlatformAdmin();
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Name the sequence." };
  const channel = formData.get("channel")?.toString() === "sms" ? "sms" : "email";
  const { error } = await supabase.from("prospect_sequences").insert({
    name,
    channel,
    auto_send: formData.get("auto_send") === "on",
    created_by: user.id,
  });
  if (error) return { error: "Could not create the sequence." };
  revalidatePath("/admin/sales/sequences");
  return { ok: true };
}

/** Add a step to a sequence (appended at the end). */
export async function addStep(_prev: SeqState, formData: FormData): Promise<SeqState> {
  const { supabase } = await requirePlatformAdmin();
  const sequenceId = formData.get("sequenceId")?.toString();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!sequenceId) return { error: "Missing sequence" };
  if (body.length < 2) return { error: "Write the message." };
  const { count } = await supabase
    .from("prospect_sequence_steps")
    .select("id", { count: "exact", head: true })
    .eq("sequence_id", sequenceId);
  const { error } = await supabase.from("prospect_sequence_steps").insert({
    sequence_id: sequenceId,
    position: count ?? 0,
    delay_days: Math.max(0, parseInt(formData.get("delay_days")?.toString() ?? "0", 10) || 0),
    subject: formData.get("subject")?.toString() || null,
    body,
    high_risk: formData.get("high_risk") === "on",
  });
  if (error) return { error: "Could not add the step." };
  revalidatePath("/admin/sales/sequences");
  return { ok: true };
}

/** Delete a step. */
export async function deleteStep(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const stepId = formData.get("stepId")?.toString();
  if (!stepId) return;
  await supabase.from("prospect_sequence_steps").delete().eq("id", stepId);
  revalidatePath("/admin/sales/sequences");
}

/** Enrol a contact into a sequence (schedules the first step). */
export async function enrolContact(_prev: SeqState, formData: FormData): Promise<SeqState> {
  const { supabase } = await requirePlatformAdmin();
  const sequenceId = formData.get("sequenceId")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const companyId = formData.get("companyId")?.toString();
  if (!sequenceId || !contactId || !companyId) return { error: "Pick a sequence and contact." };

  const { data: contact } = await supabase
    .from("prospect_contacts").select("opted_out").eq("id", contactId).single();
  if (contact?.opted_out) return { error: "That contact has opted out." };

  const { data: existing } = await supabase
    .from("prospect_enrolments")
    .select("id")
    .eq("sequence_id", sequenceId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .limit(1);
  if (existing && existing.length > 0) return { error: "Already enrolled in this sequence." };

  const { data: step0 } = await supabase
    .from("prospect_sequence_steps")
    .select("delay_days")
    .eq("sequence_id", sequenceId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const delay = (step0?.delay_days as number) ?? 0;

  const { error } = await supabase.from("prospect_enrolments").insert({
    sequence_id: sequenceId,
    prospect_company_id: companyId,
    contact_id: contactId,
    next_run_at: new Date(Date.now() + delay * 86400e3).toISOString(),
  });
  if (error) return { error: "Could not enrol. Please try again." };
  revalidatePath(`/admin/sales/${companyId}`);
  return { ok: true };
}

/** Stop an active enrolment. */
export async function stopEnrolment(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const enrolId = formData.get("enrolId")?.toString();
  const companyId = formData.get("companyId")?.toString();
  if (!enrolId) return;
  await supabase
    .from("prospect_enrolments")
    .update({ status: "stopped", stopped_reason: "manual" })
    .eq("id", enrolId);
  if (companyId) revalidatePath(`/admin/sales/${companyId}`);
}
