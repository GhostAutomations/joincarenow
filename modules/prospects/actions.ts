"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { sendEmail, sendSms, renderMergeFields } from "@/lib/comms/send";
import { buildProspectEmail } from "@/lib/comms/email-template";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { buildAndInsertDraft } from "@/lib/prospects/ai-drafts";
import { autoStage } from "@/lib/prospects/auto-stage";
import { scheduleProspectDemo } from "@/lib/prospects/demo";
import { provisionCompanyFromProspect } from "@/lib/prospects/provision";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/prospects";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProspectState = { error?: string; ok?: boolean } | undefined;

const BASE_URL = "https://www.joincarenow.com";

function normalizeUkPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t;
}

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
      value_monthly: parseFloat(formData.get("value_monthly")?.toString() ?? "") || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !company) return { error: "Could not add the prospect. Please try again." };

  const email = (formData.get("email")?.toString() ?? "").trim();
  const contactName = (formData.get("contact_name")?.toString() ?? "").trim();
  const contactPhone = (formData.get("contact_phone")?.toString() ?? "").trim();
  if (email || contactName || contactPhone) {
    await supabase.from("prospect_contacts").insert({
      prospect_company_id: company.id,
      name: contactName || null,
      email: email || null,
      phone: contactPhone || null,
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
  const nowIso = new Date().toISOString();
  await supabase.from("prospect_companies").update({ stage, updated_at: nowIso, stage_changed_at: nowIso }).eq("id", id);
  await logActivity(supabase, id, user.id, "stage_change", {
    body: `${STAGE_LABEL[(before?.stage as Stage) ?? "new"]} → ${STAGE_LABEL[stage as Stage]}`,
    meta: { from: before?.stage, to: stage },
  });

  // Stage automations (best-effort — the move is already saved).
  // Note: Proposal is sent via the proposal popup (sendProposal), not here.
  if (before?.stage !== stage) {
    try {
      if (stage === "won") await provisionCompanyFromProspect(supabase as unknown as SupabaseClient, id);
    } catch {
      /* automation failed; stage move stands */
    }
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
}

/** Founder sets the demo video link (Zoom/Meet) used in demo invites. */
export async function setVideoLink(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const link = (formData.get("video_link")?.toString() ?? "").trim();
  await supabase
    .from("platform_settings")
    .upsert({ key: "prospect_video_link", value: link, updated_at: new Date().toISOString() }, { onConflict: "key" });
  revalidatePath("/admin/sales/settings");
}

/** Send a (composed) proposal email to a prospect contact and move to Proposal. */
export async function sendProposal(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase, user } = await requirePlatformAdmin();
  const prospectId = formData.get("id")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const subject = (formData.get("subject")?.toString() ?? "").trim() || "Your Join Care Now proposal";
  const message = (formData.get("message")?.toString() ?? "").trim();
  const planRaw = formData.get("plan")?.toString();
  const plan = ["monthly", "commit", "annual"].includes(planRaw ?? "") ? planRaw! : null;
  const planLabel = plan === "annual" ? "Annual (£550/yr)" : plan === "commit" ? "12-month (£55/mo)" : plan === "monthly" ? "Monthly (£55/mo)" : null;
  const offer = (formData.get("offer")?.toString() ?? "").trim().slice(0, 200) || null;
  if (!prospectId || !contactId) return { error: "Pick a contact." };
  if (message.length < 10) return { error: "Write the proposal message first." };

  const { data: contact } = await supabase
    .from("prospect_contacts").select("email, opted_out").eq("id", contactId).single();
  if (!contact?.email) return { error: "That contact has no email address." };
  if (contact.opted_out) return { error: "That contact has opted out." };

  const res = await sendBrandedEmail(supabase as unknown as SupabaseClient, null, {
    to: contact.email as string,
    subject,
    text: message,
    cta: { label: "Get started", url: "https://www.joincarenow.com/billing" },
  });

  // Move the card to Proposal and log it.
  const { data: before } = await supabase.from("prospect_companies").select("stage").eq("id", prospectId).single();
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = { stage: "proposal", updated_at: nowIso, stage_changed_at: nowIso };
  if (plan) update.proposed_plan = plan;
  update.proposed_offer = offer;
  await supabase.from("prospect_companies").update(update).eq("id", prospectId);
  await logActivity(supabase, prospectId, user.id, "stage_change", {
    body: `${STAGE_LABEL[(before?.stage as Stage) ?? "new"]} → Proposal`,
    meta: { from: before?.stage, to: "proposal" },
  });
  await supabase.from("prospect_activities").insert({
    prospect_company_id: prospectId,
    contact_id: contactId,
    type: "system",
    body: res.ok
      ? `Proposal sent to ${contact.email}${planLabel ? ` — ${planLabel}` : ""}${offer ? ` + ${offer}` : ""}.`
      : `Proposal email failed: ${res.error}`,
  });

  revalidatePath(`/admin/sales/${prospectId}`);
  revalidatePath("/admin/sales");
  if (!res.ok) return { error: res.error ?? "Could not send the proposal." };
  return { ok: true };
}

/** Contacts for a prospect (used by the drag-to-Demo-booked scheduler popup). */
export async function getProspectContacts(prospectId: string): Promise<{ id: string; name: string | null; email: string | null }[]> {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase
    .from("prospect_contacts")
    .select("id, name, email")
    .eq("prospect_company_id", prospectId)
    .order("created_at");
  return (data ?? []) as { id: string; name: string | null; email: string | null }[];
}

/** Book a demo with a prospect contact (sends a branded calendar invite). */
export async function scheduleDemo(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase } = await requirePlatformAdmin();
  const prospectId = formData.get("id")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const at = formData.get("at")?.toString();
  const duration = parseInt(formData.get("duration")?.toString() ?? "30", 10) || 30;
  if (!prospectId || !contactId || !at) return { error: "Pick a contact and a time." };
  const startIso = new Date(at).toISOString();
  if (Number.isNaN(Date.parse(startIso))) return { error: "That date/time looks invalid." };

  const r = await scheduleProspectDemo(supabase as unknown as SupabaseClient, {
    prospectId, contactId, startIso, durationMinutes: duration,
  });
  revalidatePath(`/admin/sales/${prospectId}`);
  revalidatePath("/admin/sales");
  if (r.error) return { error: r.error };
  return { ok: true };
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

/** Send an email or SMS to a prospect contact via the comms hub, on the
 *  separate prospecting domain, and log it to the timeline. Suppressed /
 *  opted-out contacts are blocked. */
export async function sendProspectMessage(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase, user } = await requirePlatformAdmin();
  const companyId = formData.get("id")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const channelRaw = formData.get("channel")?.toString();
  const channels: ("email" | "sms")[] =
    channelRaw === "both" ? ["email", "sms"] : channelRaw === "sms" ? ["sms"] : ["email"];
  const subject = (formData.get("subject")?.toString() ?? "").trim();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!companyId || !contactId) return { error: "Missing prospect or contact" };
  if (body.length < 2) return { error: "Write a message first." };

  const { data: contact } = await supabase
    .from("prospect_contacts")
    .select("name, email, phone, opted_out, unsub_token")
    .eq("id", contactId)
    .single();
  const { data: company } = await supabase
    .from("prospect_companies").select("name").eq("id", companyId).single();
  if (!contact) return { error: "Contact not found" };
  if (contact.opted_out) return { error: "This contact has opted out and can't be messaged." };

  const values = {
    first_name: ((contact.name as string) ?? "").split(" ")[0] ?? "",
    company_name: (company?.name as string) ?? "",
  };
  const renderedSubject = renderMergeFields(subject || "A message from Join Care Now", values);
  const renderedBodyBase = renderMergeFields(body, values);

  let anyOk = false;
  let lastError: string | null = null;
  for (const ch of channels) {
    const to = ch === "email" ? (contact.email as string | null) : normalizeUkPhone(contact.phone as string | null);
    if (!to) { lastError = ch === "email" ? "No email on this contact." : "No phone on this contact."; continue; }

    const { data: supp } = await supabase
      .from("prospect_suppressions")
      .select("id")
      .or(ch === "email" ? `email.ilike.${contact.email}` : `phone.eq.${to}`)
      .limit(1);
    if (supp && supp.length > 0) { lastError = "This address is on the suppression list."; continue; }

    let outBody = renderedBodyBase;
    let result: { ok: boolean; id?: string; error?: string };
    if (ch === "email") {
      const from = process.env.RESEND_PROSPECT_FROM;
      if (!from) { lastError = "Prospecting email isn't set up yet (RESEND_PROSPECT_FROM)."; continue; }
      const built = buildProspectEmail(renderedBodyBase, `${BASE_URL}/unsubscribe/${contact.unsub_token}`);
      outBody = built.text;
      result = await sendEmail({ to, subject: renderedSubject, text: built.text, html: built.html, from, replyTo: process.env.RESEND_PROSPECT_REPLY_TO });
    } else {
      outBody = `${renderedBodyBase}\n\nReply STOP to opt out.`;
      result = await sendSms({ to, body: outBody });
    }

    await supabase.from("prospect_activities").insert({
      prospect_company_id: companyId,
      contact_id: contactId,
      type: "message",
      channel: ch,
      direction: "outbound",
      subject: ch === "email" ? renderedSubject : null,
      body: outBody,
      status: result.ok ? "sent" : "failed",
      provider_id: result.id ?? null,
      to_address: to,
      actor_id: user.id,
    });
    if (result.ok) anyOk = true; else lastError = result.error ?? "Could not send.";
  }

  if (anyOk) await autoStage(supabase as unknown as SupabaseClient, companyId, "sent");

  revalidatePath(`/admin/sales/${companyId}`);
  revalidatePath("/admin/sales");
  if (!anyOk) return { error: lastError ?? "Could not send." };
  return { ok: true };
}

/** Draft the next message for a contact with AI, into the approval queue. */
export async function draftWithAi(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const channel = formData.get("channel")?.toString() === "sms" ? "sms" : "email";
  if (!id || !contactId) return { error: "Pick a contact first." };

  const r = await buildAndInsertDraft(supabase as unknown as SupabaseClient, id, contactId, channel);
  if (r.error) return { error: r.error };

  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/admin/sales/approvals");
  return { ok: true };
}

/** Founder sets the AI auto-send mode (off | low_risk | all). */
export async function setAutoSendMode(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const mode = formData.get("mode")?.toString();
  if (!["off", "low_risk", "all"].includes(mode ?? "")) return;
  await supabase
    .from("platform_settings")
    .upsert({ key: "prospect_autosend", value: mode, updated_at: new Date().toISOString() }, { onConflict: "key" });
  revalidatePath("/admin/sales");
}

/** Founder sets the CRM agent sending window (hours, Europe/London). */
export async function setSendWindow(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const start = parseInt(formData.get("start_hour")?.toString() ?? "", 10);
  const end = parseInt(formData.get("end_hour")?.toString() ?? "", 10);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return;
  if (start < 0 || start > 23 || end < 0 || end > 23 || start >= end) return;
  const now = new Date().toISOString();
  await supabase.from("platform_settings").upsert(
    [
      { key: "prospect_send_start_hour", value: String(start), updated_at: now },
      { key: "prospect_send_end_hour", value: String(end), updated_at: now },
    ],
    { onConflict: "key" }
  );
  revalidatePath("/admin/sales/settings");
}

/** Set a prospect's estimated monthly value. */
export async function setProspectValue(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const raw = formData.get("value_monthly")?.toString() ?? "";
  const value = raw.trim() === "" ? null : parseFloat(raw) || null;
  await supabase.from("prospect_companies").update({ value_monthly: value }).eq("id", id);
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/admin/sales");
}

/** Delete a contact from a prospect. */
export async function deleteProspectContact(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const contactId = formData.get("contactId")?.toString();
  const id = formData.get("id")?.toString();
  if (!contactId) return;
  await supabase.from("prospect_contacts").delete().eq("id", contactId);
  if (id) revalidatePath(`/admin/sales/${id}`);
}

/** Delete an entire prospect company (cascades contacts, activities, tasks). */
export async function deleteProspect(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await supabase.from("prospect_companies").delete().eq("id", id);
  revalidatePath("/admin/sales");
  redirect("/admin/sales");
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
