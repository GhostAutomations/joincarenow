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

  // Create the company (retry the slug if taken).
  const base = slugify(prospect.name as string) || "care-company";
  let companyId: string | null = null;
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db.rpc("create_company", { company_name: prospect.name, company_slug: slug });
    if (!error) {
      companyId = data as string;
      break;
    }
    if (!error.message.includes("duplicate key")) return { error: error.message };
  }
  if (!companyId) return { error: "Could not create the company." };

  await db.from("prospect_companies").update({ provisioned_company_id: companyId }).eq("id", prospectId);

  let note = "no admin email on file — invite manually";
  if (admin?.email) {
    const { data: invite, error: inviteErr } = await db.rpc("create_invitation", {
      p_company_id: companyId,
      p_email: admin.email,
      p_role: "admin",
    });
    if (!inviteErr && invite?.token) {
      const link = `${BASE_URL}/accept-invite?token=${invite.token}`;
      const firstName = ((admin.name as string) ?? "").split(" ")[0] || "there";
      await sendBrandedEmail(db, null, {
        to: admin.email as string,
        subject: "Welcome to Join Care Now — set up your account",
        text:
          `Hi ${firstName},\n\n` +
          `Great to have you on board. Your Join Care Now account for ${prospect.name} is ready.\n\n` +
          `Click below to set your password and log in. From there you can add your jobs, branding and team.\n\n${link}\n\n` +
          `Welcome aboard,\nThe Join Care Now team`,
        cta: { label: "Set up your account", url: link },
      });
      note = `admin invite sent to ${admin.email}`;
    } else {
      note = `company created, but the admin invite failed: ${inviteErr?.message ?? "unknown"}`;
    }
  }

  await db.from("prospect_activities").insert({
    prospect_company_id: prospectId,
    type: "system",
    body: `Won — company "${prospect.name}" created; ${note}.`,
    meta: { company_id: companyId },
  });

  return { ok: true, companyId };
}
