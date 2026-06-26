import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { seedCompanyStarter } from "@/lib/setup/seed";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** When a prospect is Won: create the company tenant and invite its first admin
 *  from the prospect's details. Idempotent — won't re-provision once linked. */
export async function provisionCompanyFromProspect(
  db: SupabaseClient,
  prospectId: string
): Promise<{ ok?: boolean; error?: string; companyId?: string }> {
  const { data: prospect } = await db
    .from("prospect_companies")
    .select("name, provisioned_company_id, proposed_plan, proposed_offer")
    .eq("id", prospectId)
    .single();
  if (!prospect) return { error: "Prospect not found." };
  if (prospect.provisioned_company_id) return { ok: true, companyId: prospect.provisioned_company_id as string };

  const { data: contacts } = await db
    .from("prospect_contacts")
    .select("id, name, email, opted_out")
    .eq("prospect_company_id", prospectId)
    .order("created_at");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = (contacts ?? []).find((c: any) => c.email && !c.opted_out);

  // Create the company + a pending admin invitation in one auth-free RPC (works
  // from the founder drag AND the public proposal-Accept link). Retry the slug
  // if it's already taken.
  const base = slugify(prospect.name as string) || "care-company";
  let companyId: string | null = null;
  let inviteToken: string | null = null;
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db.rpc("provision_prospect_company", {
      p_name: prospect.name,
      p_slug: slug,
      p_admin_email: admin?.email ?? null,
    });
    if (!error) {
      const result = data as { company_id: string; invite_token: string | null };
      companyId = result.company_id;
      inviteToken = result.invite_token;
      break;
    }
    if (!error.message.includes("duplicate") && !error.message.includes("unique")) return { error: error.message };
  }
  if (!companyId) return { error: "Could not create the company." };

  await db.from("prospect_companies").update({ provisioned_company_id: companyId }).eq("id", prospectId);
  // Carry the sold plan + any concession onto the company so the subscription
  // agreement (signed at account setup) reflects what they were sold. Best-effort
  // — must never block the welcome email if the columns aren't present yet.
  try {
    await db.from("companies").update({
      agreed_plan: (prospect.proposed_plan as string) ?? null,
      agreed_offer: (prospect.proposed_offer as string) ?? null,
    }).eq("id", companyId);
  } catch {
    /* columns missing or update failed — provisioning + invite continue */
  }

  // Seed the full starter pack (forms, onboarding workflow, message templates,
  // sample job + comms defaults) so the company is turnkey on day one. Uses the
  // service-role admin client internally; best-effort — never block the invite.
  try {
    await seedCompanyStarter(companyId);
  } catch {
    /* seeding is best-effort; the founder can re-apply from /founder if it fails */
  }

  let note = "no admin email on file — invite manually";
  if (admin?.email && inviteToken) {
    const firstName = ((admin.name as string) ?? "").split(" ")[0] || "there";
    // Phase-1 welcome — reassure them setup is underway. The login link comes in
    // the "account ready" email the founder fires once setup is complete.
    await sendBrandedEmail(db, null, {
      to: admin.email as string,
      subject: "Welcome to Join Care Now — we're setting up your account",
      text:
        `Hi ${firstName},\n\n` +
        `Great to have you on board. We're getting ${prospect.name}'s Join Care Now account set up for you now.\n\n` +
        `There's nothing you need to do yet — we'll email you as soon as it's ready and you can log in.\n\n` +
        `Welcome aboard,\nThe Join Care Now team`,
    });
    note = `welcome email sent to ${admin.email}`;
  } else if (admin?.email) {
    note = "company created, but the admin invite could not be generated";
  }

  await db.from("prospect_activities").insert({
    prospect_company_id: prospectId,
    type: "system",
    body: `Won — company "${prospect.name}" created; ${note}.`,
    meta: { company_id: companyId },
  });

  return { ok: true, companyId };
}
