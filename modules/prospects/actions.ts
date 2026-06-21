"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { sendEmail, sendSms, renderMergeFields } from "@/lib/comms/send";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/prospects";

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

/** Send an email or SMS to a prospect contact via the comms hub, on the
 *  separate prospecting domain, and log it to the timeline. Suppressed /
 *  opted-out contacts are blocked. */
export async function sendProspectMessage(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const { supabase, user } = await requirePlatformAdmin();
  const companyId = formData.get("id")?.toString();
  const contactId = formData.get("contactId")?.toString();
  const channel = formData.get("channel")?.toString() === "sms" ? "sms" : "email";
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

  const to = channel === "email" ? (contact.email as string | null) : normalizeUkPhone(contact.phone as string | null);
  if (!to) return { error: channel === "email" ? "No email on this contact." : "No phone on this contact." };

  // Global suppression check.
  const { data: supp } = await supabase
    .from("prospect_suppressions")
    .select("id")
    .or(channel === "email" ? `email.ilike.${(contact.email as string)}` : `phone.eq.${to}`)
    .limit(1);
  if (supp && supp.length > 0) return { error: "This address is on the suppression list." };

  const values = {
    first_name: ((contact.name as string) ?? "").split(" ")[0] ?? "",
    company_name: (company?.name as string) ?? "",
  };
  const renderedSubject = renderMergeFields(subject || "A message from Join Care Now", values);
  let renderedBody = renderMergeFields(body, values);

  let result: { ok: boolean; id?: string; error?: string };
  if (channel === "email") {
    const from = process.env.RESEND_PROSPECT_FROM;
    if (!from) return { error: "Prospecting email isn't set up yet (RESEND_PROSPECT_FROM)." };
    const unsubUrl = `${BASE_URL}/unsubscribe/${contact.unsub_token}`;
    renderedBody += `\n\n—\nYou're receiving this because we think Join Care Now could help your service. To opt out, click here: ${unsubUrl}`;
    result = await sendEmail({ to, subject: renderedSubject, text: renderedBody, from });
  } else {
    renderedBody += "\n\nReply STOP to opt out.";
    result = await sendSms({ to, body: renderedBody });
  }

  await supabase.from("prospect_activities").insert({
    prospect_company_id: companyId,
    contact_id: contactId,
    type: "message",
    channel,
    direction: "outbound",
    subject: channel === "email" ? renderedSubject : null,
    body: renderedBody,
    status: result.ok ? "sent" : "failed",
    provider_id: result.id ?? null,
    to_address: to,
    actor_id: user.id,
  });

  revalidatePath(`/admin/sales/${companyId}`);
  if (!result.ok) return { error: result.error ?? "Could not send." };
  return { ok: true };
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
