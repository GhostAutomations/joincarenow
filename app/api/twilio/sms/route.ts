import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Match the sender to an applicant by the last 10 digits of their phone.
  const fromKey = last10(from);
  const { data: applicants } = await admin
    .from("applicants")
    .select("id, phone")
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

  return xml(200);
}
