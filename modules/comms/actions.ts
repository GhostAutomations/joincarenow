"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { renderMergeFields } from "@/lib/comms/send";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { sendCompanySms } from "@/lib/billing/usage";

export type Msg = {
  id: string;
  channel: "email" | "sms" | "note";
  direction: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  created_at: string;
};

export type ThreadTemplate = {
  id: string;
  channel: "email" | "sms";
  name: string;
  subject: string | null;
  body: string;
};

/** Load the message timeline + templates for an application. */
export async function getApplicantThread(
  applicationId: string
): Promise<{ messages: Msg[]; templates: ThreadTemplate[] }> {
  const { supabase, current } = await requireCompany();
  const [{ data: messages }, { data: templates }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, channel, direction, subject, body, status, error, created_at")
      .eq("application_id", applicationId)
      // Oldest first so the newest message is at the bottom (chat style).
      .order("created_at", { ascending: true }),
    supabase
      .from("message_templates")
      .select("id, channel, name, subject, body")
      .eq("company_id", current.company_id)
      .order("name"),
  ]);
  return {
    messages: (messages ?? []) as Msg[],
    templates: (templates ?? []) as ThreadTemplate[],
  };
}

export type SendState = { error?: string; ok?: boolean } | undefined;

/** Best-effort normalise a UK mobile to E.164 (+44…) for Twilio.
 *  Leaves already-international (+) numbers untouched. */
function normalizeUkPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t; // fall through; Twilio will validate
}

/** Build the merge-field values for an application. */
async function mergeContext(
  supabase: Awaited<ReturnType<typeof requireCompany>>["supabase"],
  applicationId: string,
  senderName: string
) {
  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, applicant_id, company_id, applicants(first_name, last_name, email, phone), jobs(title), companies(name)"
    )
    .eq("id", applicationId)
    .single();
  if (!app) return null;

  const ap = app.applicants as unknown as {
    first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
  } | null;
  const job = app.jobs as unknown as { title: string | null } | null;
  const company = app.companies as unknown as { name: string | null } | null;

  return {
    applicant_id: app.applicant_id as string,
    company_id: app.company_id as string,
    email: ap?.email ?? null,
    phone: ap?.phone ?? null,
    values: {
      first_name: ap?.first_name ?? "",
      last_name: ap?.last_name ?? "",
      job_title: job?.title ?? "",
      company_name: company?.name ?? "",
      recruiter_name: senderName,
      portal_link: "https://joincarenow.com/portal",
    } as Record<string, string>,
  };
}

/** Send an email or SMS to the applicant, then log it to the timeline. */
export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const applicationId = formData.get("applicationId")?.toString();
  const channel = formData.get("channel")?.toString() ?? "email";
  if (!applicationId) return { error: "Missing applicant" };
  if (!["email", "sms"].includes(channel)) return { error: "Pick a channel" };
  const rawBody = (formData.get("body")?.toString() ?? "").trim();
  if (!rawBody) return { error: "Write a message first" };
  const rawSubject = formData.get("subject")?.toString() ?? "";

  const { supabase, user, current } = await requireCompany();
  const senderName = user.user_metadata?.full_name || user.email || "the team";
  const ctx = await mergeContext(supabase, applicationId, senderName);
  if (!ctx) return { error: "Application not found" };

  const to = channel === "email" ? ctx.email : normalizeUkPhone(ctx.phone);
  if (!to) return { error: channel === "email" ? "No email address on file" : "No phone number on file" };

  const subject = channel === "email" ? renderMergeFields(rawSubject, ctx.values) : null;
  const body = renderMergeFields(rawBody, ctx.values);

  const result =
    channel === "email"
      ? await sendBrandedEmail(supabase, current.company_id, {
          to, subject: subject || "(no subject)", text: body,
          cta: { label: "Respond to the message", url: `https://www.joincarenow.com/portal/conversations/${applicationId}` },
        })
      : await sendCompanySms(current.company_id, { to, body });

  await supabase.from("messages").insert({
    company_id: current.company_id,
    application_id: applicationId,
    applicant_id: ctx.applicant_id,
    channel,
    direction: "outbound",
    to_address: to,
    subject,
    body,
    status: result.ok ? "sent" : "failed",
    provider_id: result.id ?? null,
    error: result.ok ? null : result.error ?? null,
    created_by: user.id,
  });

  revalidatePath("/pipeline");
  if (!result.ok) return { error: result.error ?? "Could not send" };
  return { ok: true };
}

/** Send a templated email/SMS to the applicant and log it to the timeline.
 *  Reusable from other actions (sending a form, requesting a CV, etc.).
 *  Best-effort: never throws; returns ok/error. */
export async function notifyApplicant(opts: {
  applicationId: string;
  channel: "email" | "sms";
  subject?: string;
  body: string;
  /** Branded call-to-action. On email it renders as the branded button (no
   *  plain-text links in customer emails). On SMS the link is appended inline,
   *  since SMS has no buttons. Both label and url support merge fields. */
  cta?: { label: string; url: string };
}): Promise<{ ok: boolean; error?: string }> {
  const { applicationId, channel } = opts;
  const { supabase, user, current } = await requireCompany();
  const senderName = user.user_metadata?.full_name || user.email || "the team";
  const ctx = await mergeContext(supabase, applicationId, senderName);
  if (!ctx) return { ok: false, error: "Application not found" };

  const to = channel === "email" ? ctx.email : normalizeUkPhone(ctx.phone);
  if (!to) return { ok: false, error: channel === "email" ? "No email on file" : "No phone on file" };

  const subject = channel === "email" ? renderMergeFields(opts.subject ?? "", ctx.values) : null;
  let body = renderMergeFields(opts.body, ctx.values);
  const cta = opts.cta
    ? { label: renderMergeFields(opts.cta.label, ctx.values), url: renderMergeFields(opts.cta.url, ctx.values) }
    : undefined;
  // SMS has no buttons: append the link inline so the applicant can still act.
  if (channel === "sms" && cta) body = `${body}\n\n${cta.url}`;

  const result =
    channel === "email"
      ? await sendBrandedEmail(supabase, current.company_id, { to, subject: subject || "(no subject)", text: body, cta })
      : await sendCompanySms(current.company_id, { to, body });

  await supabase.from("messages").insert({
    company_id: current.company_id,
    application_id: applicationId,
    applicant_id: ctx.applicant_id,
    channel,
    direction: "outbound",
    to_address: to,
    subject,
    body,
    status: result.ok ? "sent" : "failed",
    provider_id: result.id ?? null,
    error: result.ok ? null : result.error ?? null,
    created_by: user.id,
  });
  revalidatePath("/pipeline");
  return { ok: result.ok, error: result.ok ? undefined : result.error };
}

/** Log an internal note to the applicant's timeline (not sent anywhere). */
export async function addNote(_prev: SendState, formData: FormData): Promise<SendState> {
  const applicationId = formData.get("applicationId")?.toString();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!applicationId) return { error: "Missing applicant" };
  if (!body) return { error: "Write a note first" };

  const { supabase, user, current } = await requireCompany();
  const { data: app } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .single();

  await supabase.from("messages").insert({
    company_id: current.company_id,
    application_id: applicationId,
    applicant_id: app?.applicant_id ?? null,
    channel: "note",
    direction: "outbound",
    body,
    status: "logged",
    created_by: user.id,
  });

  revalidatePath("/pipeline");
  return { ok: true };
}
