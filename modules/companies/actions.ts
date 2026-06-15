"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

/** Build an absolute accept-invite URL from the incoming request host. */
async function acceptUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "joincarenow.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/accept-invite?token=${token}`;
}

const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(120),
  adminEmail: z.string().email("Enter a valid admin email address"),
});

export type CompanyState =
  | { error?: string; inviteLink?: string; invitedEmail?: string }
  | undefined;

/** Founder-only (enforced in the create_company / create_invitation RPCs).
 *  Creates the company AND invites its first admin in one step. */
export async function createCompany(
  _prev: CompanyState,
  formData: FormData
): Promise<CompanyState> {
  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    adminEmail: formData.get("adminEmail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) return { error: "Company name must contain letters or numbers" };

  // 1. Create the company (retry slug if taken). RPC returns its new id.
  let companyId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase.rpc("create_company", {
      company_name: parsed.data.name,
      company_slug: slug,
    });

    if (!error) {
      companyId = data as string;
      break;
    }
    if (!error.message.includes("duplicate key")) {
      return { error: error.message || "Could not create company. Please try again." };
    }
  }
  if (!companyId) {
    return { error: "Could not generate a unique web address. Try a different name." };
  }

  // 2. Invite the first admin for that company.
  const { data: invite, error: inviteError } = await supabase.rpc(
    "create_invitation",
    {
      p_company_id: companyId,
      p_email: parsed.data.adminEmail,
      p_role: "admin",
    }
  );

  revalidatePath("/admin");

  if (inviteError) {
    // Company was created; only the invite failed. Tell the founder so they can
    // re-send from the company's card.
    return {
      error: `Company created, but the admin invite failed: ${inviteError.message}. Use "Invite an administrator" on the company below.`,
    };
  }

  return {
    inviteLink: await acceptUrl(invite.token),
    invitedEmail: parsed.data.adminEmail,
  };
}

// ---------- Company profile: interview address ----------

export type SettingsState = { error?: string; ok?: boolean } | undefined;

/** Admins set the default in-person interview address for their company.
 *  Stored in companies.settings.interview_address. RLS limits this to admins. */
export async function setInterviewAddress(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string") return { error: "Missing company" };
  const address = (formData.get("interviewAddress")?.toString() ?? "").slice(0, 500);

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    interview_address: address,
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings })
    .eq("id", companyId);

  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Admins choose how Employee IDs are assigned: auto-generated with a prefix,
 *  or entered manually (for companies with their own payroll numbers). */
export async function setEmployeeNumberSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string") return { error: "Missing company" };

  const mode = formData.get("mode") === "manual" ? "manual" : "auto";
  let prefix = (formData.get("prefix")?.toString() ?? "").trim().slice(0, 20);
  if (mode === "auto" && !prefix) prefix = "EMP-";

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    employee_number_mode: mode,
    employee_number_prefix: prefix,
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings })
    .eq("id", companyId);

  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}
