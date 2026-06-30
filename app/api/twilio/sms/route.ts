import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoStage } from "@/lib/prospects/auto-stage";
import { notifyJobOwner } from "@/lib/comms/notify-owner";
import { sendCompanySms } from "@/lib/billing/usage";
import { BASE_URL } from "@/lib/billing/stripe";

export const runtime = "nodejs";

// Empty TwiML — tells Twilio we received it and don't want to auto-reply.
const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = (status = 200) =>
  new Response(TWIML_OK, { status, headers: { "Content-Type": "text/xml" } });

/** Last 10 digits of a phone number — lets us match across +44 / 0 / spaced formats. */
function last10(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** Validate Twilio's X-Twilio-Signature for an x-www-form-urlencoded POST. */
function isValidTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const data =
    url +
    Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], "");
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Health check — visit this URL in a browser to confirm the route is deployed.
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, route: "twilio-sms", expects: "POST" }),
    { headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return xml(200); // not configured; ack so Twilio doesn't retry

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : "";

  // Reconstruct the public URL Twilio signed against.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const url = `https://${host}/api/twilio/sms`;
  const signature = req.headers.get("x-twilio-signature") ?? "";

  if (!isValidTwilioSignature(authToken, signature, url, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const from = params["From"];
  const body = params["Body"] ?? "";
  if (!from) return xml(200);

  const admin = createAdminClient();
  const fromKey = last10(from);

  // 1) Prospect CRM contact? Thread the reply onto the prospect timeline (auto-
  //    stops their sequence). STOP / UNSUBSCRIBE also opts them out + suppresses.
  const { data: pContacts } = await admin
    .from("prospect_contacts")
    .select("id, prospect_company_id, phone")
    .not("phone", "is", null);
  const pContact = (pContacts ?? []).find((c) => last10(c.phone) === fromKey);
  if (pContact) {
    await admin.from("prospect_activities").insert({
      prospect_company_id: pContact.prospect_company_id,
      contact_id: pContact.id,
      type: "message",
      channel: "sms",
      direction: "inbound",
      to_address: from,
      body,
      status: "delivered",
    });
    const upper = body.trim().toUpperCase();
    if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upper)) {
      await admin.from("prospect_contacts").update({ opted_out: true }).eq("id", pContact.id);
      await admin.from("prospect_suppressions").insert({ phone: from, reason: "SMS STOP" });
      await autoStage(admin, pContact.prospect_company_id as string, "optout");
    } else {
      await autoStage(admin, pContact.prospect_company_id as string, "reply");
    }
    return xml(200);
  }

  // Match the sender to an applicant by the last 10 digits of their phone.
  const { data: applicants } = await admin
    .from("applicants")
    .select("id, phone, first_name, last_name")
    .not("phone", "is", null);
  const applicant = (applicants ?? []).find((a) => last10(a.phone) === fromKey);
  if (!applicant) return xml(200); // unknown sender — ignore quietly

  // Attach to their most recent application (gives us the company + thread).
  const { data: app } = await admin
    .from("applications")
    .select("id, company_id")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return xml(200);

  await admin.from("messages").insert({
    company_id: app.company_id,
    application_id: app.id,
    applicant_id: applicant.id,
    channel: "sms",
    direction: "inbound",
    to_address: from,
    body,
    status: "delivered",
  });

  // If Poppy is mid-screening with this applicant, the conversation lives in
  // their portal — nudge them back there (one SMS) instead of alerting the owner.
  const { data: pr } = await admin
    .from("poppy_reports")
    .select("phase")
    .eq("application_id", app.id)
    .maybeSingle();
  if (pr?.phase === "conversing") {
    const link = `${BASE_URL}/portal/conversations/${app.id}`;
    const nudge = `Thanks! To make sure I record your answer, please reply in your portal: ${link}`;
    const r = await sendCompanySms(app.company_id, { to: from, body: nudge });
    await admin.from("messages").insert({
      company_id: app.company_id,
      application_id: app.id,
      applicant_id: applicant.id,
      channel: "sms",
      direction: "outbound",
      from_poppy: true,
      body: nudge,
      status: r.ok ? "sent" : "failed",
    });
    return xml(200);
  }

  // Route the reply to the job's owner (in-app + email).
  const name =
    [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || "An applicant";
  await notifyJobOwner(admin, {
    applicationId: app.id,
    type: "sms_received",
    prefKey: "applicant_message",
    title: `New SMS from ${name}`,
    body: body.slice(0, 160),
    link: `/pipeline?open=${app.id}`,
    email: {
      subject: `${name} replied by SMS`,
      text: `${name} has sent you an SMS about their application on Join Care Now. Use the button below to read it and reply.`,
      ctaLabel: "View conversation",
      ctaUrl: `https://www.joincarenow.com/pipeline?open=${app.id}`,
    },
  });

  return xml(200);
}
