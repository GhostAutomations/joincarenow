import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/comms/send";
import { renderEmailHtml } from "@/lib/comms/email-template";

type CompanyBrandRow = {
  name: string | null;
  settings: { brand?: { primary?: string | null; logo_url?: string | null } | null } | null;
};

/**
 * Send a customer-facing transactional email wrapped in the company's brand
 * (logo + primary colour + name). Falls back to the plain Join Care Now look if
 * the company has no branding. Always sends a plain-text part too for
 * deliverability. `db` can be an RLS or admin client.
 */
export async function sendBrandedEmail(
  db: SupabaseClient,
  companyId: string | null | undefined,
  opts: {
    to: string;
    subject: string;
    text: string;
    footerNote?: string;
    replyTo?: string;
    attachments?: { filename: string; content: string }[];
    cta?: { label: string; url: string };
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let heading = "Join Care Now";
  // Platform (non-company) emails use the white JCN logo on the teal header band.
  let logoUrl: string | null = companyId ? null : "https://www.joincarenow.com/brand/jcn-logo-white-mono.png";
  let brandColor: string | undefined;

  if (companyId) {
    try {
      const { data } = await db
        .from("companies")
        .select("name, settings")
        .eq("id", companyId)
        .single();
      const row = data as CompanyBrandRow | null;
      if (row) {
        if (row.name) heading = row.name;
        const brand = row.settings?.brand;
        logoUrl = brand?.logo_url ?? null;
        brandColor = brand?.primary ?? undefined;
      }
    } catch {
      /* fall back to defaults */
    }
  }

  const html = renderEmailHtml({
    bodyText: opts.text,
    heading,
    logoUrl,
    brandColor,
    footerNote: opts.footerNote,
    cta: opts.cta,
  });

  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html,
    replyTo: opts.replyTo,
    attachments: opts.attachments,
  });
}
