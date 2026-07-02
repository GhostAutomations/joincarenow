import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBrandedEmail } from "@/lib/comms/branded";

/** Send a branded pricing proposal (the three plans) to a prospect's primary
 *  contact, and log it. Called when a prospect moves to Proposal. */
export async function sendProposalEmail(db: SupabaseClient, prospectId: string): Promise<{ ok?: boolean; error?: string }> {
  const [{ data: company }, { data: contacts }] = await Promise.all([
    db.from("prospect_companies").select("name").eq("id", prospectId).single(),
    db.from("prospect_contacts").select("id, name, email, opted_out").eq("prospect_company_id", prospectId).order("created_at"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contact = (contacts ?? []).find((c: any) => c.email && !c.opted_out);
  if (!contact) return { error: "No emailable contact for the proposal." };

  const firstName = ((contact.name as string) ?? "").split(" ")[0] || "there";
  const body =
    `Hi ${firstName},\n\n` +
    `Thanks for taking the time to look at Join Care Now. Here's a simple proposal for ${(company?.name as string) ?? "your service"}.\n\n` +
    `One plan, everything included — recruitment, onboarding and compliance in one place. Three ways to pay:\n\n` +
    `• Monthly — £49/month, cancel anytime (£150 one-off setup)\n` +
    `• 12-month plan — £49/month, no setup fee\n` +
    `• Annual — £490/year (2 months free), no setup fee\n\n` +
    `Included on every plan: every feature, core compliance (Right to Work, DBS, references), 1 branch and 100 SMS a month. ` +
    `Add-ons as you grow: extra branches £7.50/mo, SMS 8p after your 100, AI actions 10p each.\n\n` +
    `Want AI to do your first-round screening? Add Poppy, our AI recruitment assistant — from £79/month (£89 monthly, £790/year). Poppy reviews each applicant and gives your team an advisory hire recommendation; 40 applicants a month included, then 75p each.\n\n` +
    `Happy to answer anything or get you started — just reply to this email.\n\nThe Join Care Now team`;

  const res = await sendBrandedEmail(db, null, {
    to: contact.email as string,
    subject: "Your Join Care Now proposal",
    text: body,
    cta: { label: "Get started", url: "https://www.joincarenow.com/billing" },
  });

  await db.from("prospect_activities").insert({
    prospect_company_id: prospectId,
    contact_id: contact.id,
    type: "system",
    body: `Pricing proposal sent to ${contact.email}.`,
  });

  return res.ok ? { ok: true } : { error: res.error };
}
