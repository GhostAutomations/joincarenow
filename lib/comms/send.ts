// Email/SMS sending via Resend + Twilio REST APIs (fetch, no SDK deps).
// All functions return { ok, id?, error? } and never throw.

import { logError } from "@/lib/errors/log";

export type SendResult = { ok: boolean; id?: string; error?: string };

/** Send a transactional email via Resend. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  from?: string; // override the default sending identity (e.g. cold-outbound domain)
  replyTo?: string;
  attachments?: { filename: string; content: string }[]; // content = base64
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = opts.from || process.env.RESEND_FROM; // e.g. "Join Care Now <no-reply@joincarenow.com>"
  if (!key || !from) {
    return { ok: false, error: "Email is not configured yet (missing RESEND_API_KEY / RESEND_FROM)." };
  }

  // Optional: route replies to a Resend inbound address so they're captured.
  const replyTo = opts.replyTo || process.env.RESEND_REPLY_TO;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      const error = data.message || `Email failed (${res.status})`;
      await logError({ source: "email", message: error, code: String(res.status), detail: { to: opts.to, subject: opts.subject } });
      return { ok: false, error };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Email send failed";
    await logError({ source: "email", message: error, detail: { to: opts.to, subject: opts.subject } });
    return { ok: false, error };
  }
}

/** Send an SMS via Twilio. */
export async function sendSms(opts: { to: string; body: string }): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM; // your Twilio number, e.g. "+447..."
  if (!sid || !token || !from) {
    return { ok: false, error: "SMS is not configured yet (missing TWILIO_* env vars)." };
  }

  try {
    const body = new URLSearchParams({ To: opts.to, From: from, Body: opts.body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      const error = data.message || `SMS failed (${res.status})`;
      await logError({ source: "sms", message: error, code: String(data.code ?? res.status), detail: { to: opts.to } });
      return { ok: false, error };
    }
    return { ok: true, id: data.sid };
  } catch (e) {
    const error = e instanceof Error ? e.message : "SMS send failed";
    await logError({ source: "sms", message: error, detail: { to: opts.to } });
    return { ok: false, error };
  }
}

/** Replace {{merge_field}} tokens with values (unknown tokens left blank). */
export function renderMergeFields(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = values[key.toLowerCase()];
    return v ?? "";
  });
}
