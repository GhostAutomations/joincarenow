"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { sendEmail, sendSms, renderMergeFields } from "@/lib/comms/send";

const BASE_URL = "https://www.joincarenow.com";

function normalizeUkPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t;
}

/** Founder approves a parked draft (agent- or sequence-generated): sends it now,
 *  marks it sent, and resumes the sequence if it came from one. */
export async function approveDraft(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user } = await requirePlatformAdmin();
  const draftId = formData.get("draftId")?.toString();
  if (!draftId) return { error: "Missing draft" };

  const { data: draft } = await supabase
    .from("prospect_activities")
    .select("id, prospect_company_id, contact_id, channel, subject, body, meta, needs_approval")
    .eq("id", draftId)
    .single();
  if (!draft || !draft.needs_approval) return { error: "Draft not found" };

  const subject = (formData.get("subject")?.toString() ?? draft.subject ?? "").trim();
  const body = (formData.get("body")?.toString() ?? draft.body ?? "").trim();
  const channel = draft.channel === "sms" ? "sms" : "email";

  const { data: contact } = await supabase
    .from("prospect_contacts").select("id, name, email, phone, opted_out, unsub_token").eq("id", draft.contact_id).single();
  const { data: company } = await supabase
    .from("prospect_companies").select("name").eq("id", draft.prospect_company_id).single();
  if (!contact) return { error: "Contact not found" };
  if (contact.opted_out) return { error: "Contact has opted out." };

  const to = channel === "email" ? (contact.email as string | null) : normalizeUkPhone(contact.phone as string | null);
  if (!to) return { error: channel === "email" ? "No email on contact." : "No phone on contact." };

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
    renderedBody += `\n\n—\nTo opt out, click here: ${BASE_URL}/unsubscribe/${contact.unsub_token}`;
    result = await sendEmail({ to, subject: renderedSubject, text: renderedBody, from });
  } else {
    renderedBody += "\n\nReply STOP to opt out.";
    result = await sendSms({ to, body: renderedBody });
  }

  await supabase.from("prospect_activities").update({
    subject: channel === "email" ? renderedSubject : null,
    body: renderedBody,
    direction: "outbound",
    status: result.ok ? "sent" : "failed",
    provider_id: result.id ?? null,
    to_address: to,
    needs_approval: false,
    actor_id: user.id,
  }).eq("id", draftId);

  await supabase.rpc("log_audit", {
    p_company_id: null,
    p_action: "prospect.message_approved_sent",
    p_entity_type: "prospect_company",
    p_entity_id: draft.prospect_company_id,
    p_before: {},
    p_after: { channel, to },
  });

  // Resume the sequence this draft came from, if any.
  const meta = (draft.meta ?? {}) as { enrolment_id?: string; step_index?: number };
  if (result.ok && meta.enrolment_id) {
    const { data: enr } = await supabase
      .from("prospect_enrolments").select("id, sequence_id, step_index").eq("id", meta.enrolment_id).single();
    if (enr) {
      const { data: steps } = await supabase
        .from("prospect_sequence_steps").select("delay_days").eq("sequence_id", enr.sequence_id).order("position");
      const nextIdx = (enr.step_index as number) + 1;
      const next = (steps ?? [])[nextIdx];
      if (next) {
        await supabase.from("prospect_enrolments").update({
          status: "active",
          step_index: nextIdx,
          next_run_at: new Date(Date.now() + ((next.delay_days as number) ?? 0) * 86400e3).toISOString(),
          stopped_reason: null,
        }).eq("id", enr.id);
      } else {
        await supabase.from("prospect_enrolments").update({ status: "done", step_index: nextIdx }).eq("id", enr.id);
      }
    }
  }

  revalidatePath("/admin/sales/approvals");
  revalidatePath(`/admin/sales/${draft.prospect_company_id}`);
  if (!result.ok) return { error: result.error ?? "Could not send." };
  return { ok: true };
}

/** Founder discards a parked draft (does not send). */
export async function discardDraft(formData: FormData): Promise<void> {
  const { supabase } = await requirePlatformAdmin();
  const draftId = formData.get("draftId")?.toString();
  if (!draftId) return;
  await supabase.from("prospect_activities").delete().eq("id", draftId).eq("needs_approval", true);
  revalidatePath("/admin/sales/approvals");
}
