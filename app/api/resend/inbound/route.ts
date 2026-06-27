import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoStage } from "@/lib/prospects/auto-stage";
import { isProduction } from "@/lib/security/prod";
import { notifyJobOwner } from "@/lib/comms/notify-owner";
import { sendBrandedEmail } from "@/lib/comms/branded";

export const runtime = "nodejs";

// Inbound mail to this address is treated as a sales enquiry → CRM + forwarded.
const SALES_ADDRESS = "sales@joincarenow.com";

/** Display name out of "Name <email>" (empty if none). */
function senderName(raw: string): string {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : "";
}

// Free/personal email providers — their domain is NOT a company name.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "icloud.com", "me.com", "mac.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "btinternet.com", "sky.com",
]);

/** Equivalent addresses for matching — Apple routes me/mac/icloud to one
 *  mailbox, so treat them as the same contact (avoids duplicate leads). */
function emailAliases(email: string): string[] {
  const at = email.lastIndexOf("@");
  if (at < 0) return [email];
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (["me.com", "mac.com", "icloud.com"].includes(domain)) {
    return ["icloud.com", "me.com", "mac.com"].map((d) => `${local}@${d}`);
  }
  return [email];
}

/** Best company name for a cold lead: their display name, else the email domain
 *  for a business address, else a clear placeholder for personal providers. */
function leadCompanyName(fromName: string, fromEmail: string): string {
  if (fromName) return fromName;
  const domain = fromEmail.split("@")[1]?.toLowerCase() ?? "";
  if (domain && !PERSONAL_EMAIL_DOMAINS.has(domain)) return domain;
  return `New enquiry (${fromEmail})`;
}

/** Forward a copy of a sales@ email to the founder's inbox so they can read it
 *  (e.g. verification links) and reply directly. */
async function forwardToFounder(
  db: SupabaseClient,
  opts: { fromName: string; fromEmail: string; subject: string | null; body: string }
): Promise<void> {
  const { data } = await db
    .from("profiles")
    .select("email")
    .eq("is_platform_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const to = (data as { email?: string } | null)?.email;
  if (!to) return;
  const who = opts.fromName ? `${opts.fromName} <${opts.fromEmail}>` : opts.fromEmail;
  await sendBrandedEmail(db, null, {
    to,
    subject: `Sales enquiry: ${opts.subject ?? "(no subject)"}`,
    text: `From: ${who}\n\n${opts.body}`,
    replyTo: opts.fromEmail,
    footerNote: "Forwarded from sales@joincarenow.com.",
  });
}

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
  const rawBody = await req.text();

  if (!secret) {
    if (isProduction()) return new Response("Webhook not configured", { status: 500 });
  } else if (!verifySvix(secret, req.headers, rawBody)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; subject?: string; to?: string | string[] } };
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

  // Fetch the received email ONCE — recipient (to), body and subject.
  const fetchEmail = async (): Promise<{ to: string[]; body: string; subject: string | null }> => {
    let body = "";
    let subject = event.data?.subject ?? null;
    let to: string[] = [];
    const evTo = event.data?.to;
    if (Array.isArray(evTo)) to = evTo.map(emailAddress);
    else if (typeof evTo === "string") to = [emailAddress(evTo)];
    if (apiKeyEnv && event.data?.email_id) {
      try {
        const res = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, {
          headers: { Authorization: `Bearer ${apiKeyEnv}` },
        });
        const email = (await res.json().catch(() => ({}))) as { text?: string | null; html?: string | null; subject?: string | null; to?: string | string[] | null };
        body = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
        subject = email.subject ?? subject;
        if (email.to) to = Array.isArray(email.to) ? email.to.map(emailAddress) : [emailAddress(email.to)];
      } catch { /* metadata only */ }
    }
    if (!body) body = "(email received — open in your inbox to read)";
    return { to, body, subject };
  };

  const mail = await fetchEmail();
  const fromName = senderName(event.data.from ?? "");
  const isSales = mail.to.includes(SALES_ADDRESS);

  // Forward a copy of any sales@ email to the founder's inbox.
  if (isSales) {
    await forwardToFounder(admin, { fromName, fromEmail, subject: mail.subject, body: mail.body });
  }

  // 1) Known prospect? Thread the reply onto its CRM timeline (also auto-stops
  //    any active sequence on the next cron run).
  const aliasFilter = emailAliases(fromEmail).map((a) => `email.ilike.${a}`).join(",");
  const { data: pContacts } = await admin
    .from("prospect_contacts")
    .select("id, prospect_company_id")
    .or(aliasFilter)
    .limit(1);
  const pContact = (pContacts ?? [])[0];
  if (pContact) {
    await admin.from("prospect_activities").insert({
      prospect_company_id: pContact.prospect_company_id,
      contact_id: pContact.id,
      type: "message",
      channel: "email",
      direction: "inbound",
      to_address: fromEmail,
      subject: mail.subject,
      body: mail.body.slice(0, 5000),
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
  if (!applicant) {
    // Unknown sender. If they emailed sales@, create a new CRM lead with the
    // message on its timeline; otherwise ignore.
    if (isSales) {
      const companyName = leadCompanyName(fromName, fromEmail);
      const { data: pc } = await admin
        .from("prospect_companies")
        .insert({ name: companyName, source: "Inbound email (sales@)", stage: "new" })
        .select("id")
        .single();
      if (pc) {
        const { data: contact } = await admin
          .from("prospect_contacts")
          .insert({ prospect_company_id: pc.id, name: fromName || null, email: fromEmail, consent_basis: "Inbound enquiry to sales@joincarenow.com" })
          .select("id")
          .single();
        await admin.from("prospect_activities").insert({
          prospect_company_id: pc.id,
          contact_id: contact?.id ?? null,
          type: "message",
          channel: "email",
          direction: "inbound",
          to_address: fromEmail,
          subject: mail.subject,
          body: mail.body.slice(0, 5000),
          status: "delivered",
        });
      }
    }
    return ok(200);
  }

  const { data: app } = await admin
    .from("applications")
    .select("id, company_id")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return ok(200);

  // Already fetched above.
  const body = mail.body;
  const subject = mail.subject;

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
    prefKey: "applicant_message",
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
