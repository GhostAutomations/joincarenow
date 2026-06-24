import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBrandedEmail } from "@/lib/comms/branded";

const BASE_URL = "https://www.joincarenow.com";

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
    .select("name, provisioned_company_id")
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

  let note = "no admin email on file — invite manually";
  if (admin?.email && inviteToken) {
    const link = `${BASE_URL}/accept-invite?token=${inviteToken}`;
    const firstName = ((admin.name as string) ?? "").split(" ")[0] || "there";
    await sendBrandedEmail(db, null, {
      to: admin.email as string,
      subject: "Welcome to Join Care Now — set up your account",
      text:
        `Hi ${firstName},\n\n` +
        `Great to have you on board. Your Join Care Now account for ${prospect.name} is ready.\n\n` +
        `Click the button below to set your password and log in. From there you can add your jobs, branding and team.\n\n` +
        `Welcome aboard,\nThe Join Care Now team`,
      cta: { label: "Set up your account", url: link },
    });
    note = `admin invite sent to ${admin.email}`;
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
