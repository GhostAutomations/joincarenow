import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoStage } from "@/lib/prospects/auto-stage";
import { isProduction } from "@/lib/security/prod";
import { notifyJobOwner } from "@/lib/comms/notify-owner";

export const runtime = "nodejs";

const ok = (status = 200) =>
  new Response(JSON.stringify({ ok: true }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Health check — visit in a browser to confirm the route is deployed.
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, route: "resend-inbound", expects: "POST" }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/** Verify a Resend (Svix) webhook signature over the raw body. */
function verifySvix(secret: string, headers: Headers, rawBody: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest("base64");

  // Header is space-separated "v1,<sig>" entries.
  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  });
}

/** Pull a bare email address out of "Name <email>" or a plain address. */
function emailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const rawBody = await req.text();

  if (!secret) {
    if (isProduction()) return new Response("Webhook not configured", { status: 500 });
  } else if (!verifySvix(secret, req.headers, rawBody)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return ok(200);
  }
  if (event.type !== "email.received" || !event.data?.email_id) return ok(200);

  const fromEmail = emailAddress(event.data.from ?? "");
  if (!fromEmail) return ok(200);

  const admin = createAdminClient();
  const apiKeyEnv = process.env.RESEND_API_KEY;

  // Shared body fetch from Resend's Received Emails API.
  const fetchBody = async (): Promise<{ body: string; subject: string | null }> => {
    let body = "";
    let subject = event.data?.subject ?? null;
    if (apiKeyEnv && event.data?.email_id) {
      try {
        const res = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, {
          headers: { Authorization: `Bearer ${apiKeyEnv}` },
        });
        const email = (await res.json().catch(() => ({}))) as { text?: string | null; html?: string | null; subject?: string | null };
        body = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
        subject = email.subject ?? subject;
      } catch { /* metadata only */ }
    }
    if (!body) body = "(email received — open in your inbox to read)";
    return { body, subject };
  };

  // 1) Prospect CRM contact? Thread the reply onto the prospect timeline (this
  //    also auto-stops any active sequence on the next cron run).
  const { data: pContacts } = await admin
    .from("prospect_contacts")
    .select("id, prospect_company_id")
    .ilike("email", fromEmail)
    .limit(1);
  const pContact = (pContacts ?? [])[0];
  if (pContact) {
    const { body, subject } = await fetchBody();
    await admin.from("prospect_activities").insert({
      prospect_company_id: pContact.prospect_company_id,
      contact_id: pContact.id,
      type: "message",
      channel: "email",
      direction: "inbound",
      to_address: fromEmail,
      subject,
      body: body.slice(0, 5000),
      status: "delivered",
    });
    await autoStage(admin, pContact.prospect_company_id as string, "reply");
    return ok(200);
  }

  // Match the sender to an applicant by email.
  const { data: applicants } = await admin
    .from("applicants")
    .select("id, email, first_name, last_name")
    .ilike("email", fromEmail);
  const applicant = (applicants ?? [])[0];
  if (!applicant) return ok(200); // unknown sender — ignore

  const { data: app } = await admin
    .from("applications")
    .select("id, company_id")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return ok(200);

  // Fetch the body from Resend's Received Emails API.
  let body = "";
  let subject = event.data.subject ?? null;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.resend.com/emails/receiving/${event.data.email_id}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const email = (await res.json().catch(() => ({}))) as {
        text?: string | null; html?: string | null; subject?: string | null;
      };
      body = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
      subject = email.subject ?? subject;
    } catch {
      /* fall back to metadata only */
    }
  }
  if (!body) body = "(email received — open in your inbox to read)";

  await admin.from("messages").insert({
    company_id: app.company_id,
    application_id: app.id,
    applicant_id: applicant.id,
    channel: "email",
    direction: "inbound",
    to_address: fromEmail,
    subject,
    body: body.slice(0, 5000),
    status: "delivered",
  });

  const name =
    [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || "An applicant";
  // Route the reply to the job's owner (in-app + email).
  await notifyJobOwner(admin, {
    applicationId: app.id,
    type: "email_received",
    title: `New email from ${name}`,
    body: (subject ?? body).slice(0, 160),
    link: `/pipeline?open=${app.id}`,
    email: {
      subject: `${name} replied to their application`,
      text: `${name} has sent you a message about their application on Join Care Now. Use the button below to read it and reply.`,
      ctaLabel: "View conversation",
      ctaUrl: `https://www.joincarenow.com/pipeline?open=${app.id}`,
    },
  });

  return ok(200);
}
