import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendSms, renderMergeFields } from "@/lib/comms/send";
import { buildProspectEmail } from "@/lib/comms/email-template";
import { autoStage } from "@/lib/prospects/auto-stage";
import { isWithinSendingWindow } from "@/lib/prospects";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = ReturnType<typeof createAdminClient>;
const BASE_URL = "https://www.joincarenow.com";

function normalizeUkPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Contact = any;

/** Session-less send to a prospect contact (used by the cron). Mirrors the
 *  sendProspectMessage action: suppression check, unsubscribe footer, log. */
export async function sendToProspectContact(
  db: Db,
  opts: { companyId: string; contact: Contact; companyName: string; channel: "email" | "sms"; subject: string; body: string }
): Promise<{ ok: boolean; error?: string }> {
  const { companyId, contact, companyName, channel } = opts;
  if (contact.opted_out) return { ok: false, error: "opted out" };

  const to = channel === "email" ? (contact.email as string | null) : normalizeUkPhone(contact.phone as string | null);
  if (!to) return { ok: false, error: "no address" };

  const { data: supp } = await db
    .from("prospect_suppressions")
    .select("id")
    .or(channel === "email" ? `email.ilike.${contact.email}` : `phone.eq.${to}`)
    .limit(1);
  if (supp && supp.length > 0) return { ok: false, error: "suppressed" };

  const values = {
    first_name: ((contact.name as string) ?? "").split(" ")[0] ?? "",
    company_name: companyName,
  };
  const subject = renderMergeFields(opts.subject || "A message from Join Care Now", values);
  let body = renderMergeFields(opts.body, values);

  let result: { ok: boolean; id?: string; error?: string };
  if (channel === "email") {
    const from = process.env.RESEND_PROSPECT_FROM;
    if (!from) return { ok: false, error: "RESEND_PROSPECT_FROM not set" };
    const built = buildProspectEmail(body, `${BASE_URL}/unsubscribe/${contact.unsub_token}`);
    body = built.text;
    result = await sendEmail({ to, subject, text: built.text, html: built.html, from, replyTo: process.env.RESEND_PROSPECT_REPLY_TO });
  } else {
    body += "\n\nReply STOP to opt out.";
    result = await sendSms({ to, body });
  }

  await db.from("prospect_activities").insert({
    prospect_company_id: companyId,
    contact_id: contact.id,
    type: "message",
    channel,
    direction: "outbound",
    subject: channel === "email" ? subject : null,
    body,
    status: result.ok ? "sent" : "failed",
    provider_id: result.id ?? null,
    to_address: to,
  });

  if (result.ok) await autoStage(db as unknown as SupabaseClient, companyId, "sent");

  return { ok: result.ok, error: result.error };
}

export type SequenceRun = { sent: number; stopped: number; skipped: number };

/** Process all due enrolments: send the next step, advance or stop. */
export async function runProspectSequences(): Promise<SequenceRun> {
  const res: SequenceRun = { sent: 0, stopped: 0, skipped: 0 };
  // Quiet hours: never send outside 08:00–18:00 Europe/London.
  if (!isWithinSendingWindow()) return res;

  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await db
    .from("prospect_enrolments")
    .select("id, sequence_id, prospect_company_id, contact_id, step_index, prospect_sequences(channel, auto_send, active), prospect_contacts(id, name, email, phone, opted_out, unsub_token), prospect_companies(name)")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .limit(200);

  const stop = async (id: string, reason: string) => {
    await db.from("prospect_enrolments").update({ status: "stopped", stopped_reason: reason }).eq("id", id);
    res.stopped += 1;
  };

  for (const e of due ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = e as any;
    const seq = row.prospect_sequences;
    const contact = row.prospect_contacts;
    if (!seq || !contact || seq.active === false) {
      await stop(row.id, "sequence inactive");
      continue;
    }
    if (contact.opted_out) { await stop(row.id, "opted out"); continue; }

    // Stop if the contact has replied (an inbound message exists).
    const { data: inbound } = await db
      .from("prospect_activities")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("type", "message")
      .eq("direction", "inbound")
      .limit(1);
    if (inbound && inbound.length > 0) { await stop(row.id, "replied"); continue; }

    const { data: steps } = await db
      .from("prospect_sequence_steps")
      .select("position, delay_days, subject, body, high_risk")
      .eq("sequence_id", row.sequence_id)
      .order("position", { ascending: true });
    const list = steps ?? [];
    const step = list[row.step_index];
    if (!step) {
      await db.from("prospect_enrolments").update({ status: "done" }).eq("id", row.id);
      continue;
    }

    // High-risk or non-auto-send steps park as a draft for human approval (slice 6).
    if (step.high_risk || seq.auto_send === false) {
      await db.from("prospect_activities").insert({
        prospect_company_id: row.prospect_company_id,
        contact_id: contact.id,
        type: "message",
        channel: seq.channel,
        direction: "outbound",
        subject: step.subject ?? null,
        body: step.body,
        status: "logged",
        needs_approval: true,
        high_risk: step.high_risk,
        meta: { sequence_id: row.sequence_id, enrolment_id: row.id, step_index: row.step_index },
      });
      await db.from("prospect_enrolments").update({ status: "stopped", stopped_reason: "needs approval" }).eq("id", row.id);
      res.skipped += 1;
      continue;
    }

    const sent = await sendToProspectContact(db, {
      companyId: row.prospect_company_id,
      contact,
      companyName: row.prospect_companies?.name ?? "",
      channel: seq.channel,
      subject: step.subject ?? "",
      body: step.body,
    });

    if (!sent.ok) {
      // Retry in 6h (covers transient failures without spamming).
      await db.from("prospect_enrolments")
        .update({ next_run_at: new Date(Date.now() + 6 * 3600e3).toISOString() })
        .eq("id", row.id);
      res.skipped += 1;
      continue;
    }

    res.sent += 1;
    const next = list[row.step_index + 1];
    if (!next) {
      await db.from("prospect_enrolments").update({ status: "done", step_index: row.step_index + 1 }).eq("id", row.id);
    } else {
      await db.from("prospect_enrolments").update({
        step_index: row.step_index + 1,
        next_run_at: new Date(Date.now() + (next.delay_days ?? 0) * 86400e3).toISOString(),
      }).eq("id", row.id);
    }
  }

  return res;
}
