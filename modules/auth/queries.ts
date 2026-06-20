import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cookie a Founder sets to "manage as" a company (configure it with the real
 *  company tools). Only honoured for platform admins. */
export const ACTING_COMPANY_COOKIE = "jcn_acting_company";

export type Membership = {
  company_id: string;
  role: "admin" | "manager" | "recruiter";
  companies: { id: string; name: string; slug: string };
};

/** Current auth user + profile, or redirect to sign-in. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_platform_admin")
    .eq("id", user.id)
    .single();

  return { supabase, user, profile };
}

/** User's company memberships (RLS-scoped). */
export async function getMemberships() {
  const { supabase, user, profile } = await requireUser();
  const { data } = await supabase
    .from("company_users")
    .select("company_id, role, companies ( id, name, slug )")
    .eq("user_id", user.id);

  return {
    supabase,
    user,
    profile,
    memberships: (data ?? []) as unknown as Membership[],
  };
}

/** Require at least one company membership. Founders go to their console;
 *  applicants go to their portal; anyone else has no access. */
export async function requireCompany() {
  const ctx = await getMemberships();

  // Founder "managing as" a company: resolve current to the cookie's company so
  // the whole dashboard works for that company with the real tools.
  if (ctx.profile?.is_platform_admin) {
    const acting = (await cookies()).get(ACTING_COMPANY_COOKIE)?.value;
    if (acting) {
      const { data: company } = await ctx.supabase
        .from("companies")
        .select("id, name, slug")
        .eq("id", acting)
        .maybeSingle();
      if (company) {
        return {
          ...ctx,
          current: {
            company_id: company.id as string,
            role: "admin" as const,
            companies: company as Membership["companies"],
          },
          acting: true as const,
        };
      }
    }
  }

  if (ctx.memberships.length === 0) {
    if (ctx.profile?.is_platform_admin) redirect("/admin");
    // Is this person an applicant rather than staff?
    const { data: applicant } = await ctx.supabase
      .from("applicants")
      .select("id")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    redirect(applicant ? "/portal" : "/no-access");
  }
  // Single-company users go straight in; multi-company picker comes later.
  return { ...ctx, current: ctx.memberships[0] };
}

/** Resolve the client + target company for a settings write. A platform admin
 *  (Founder) may configure ANY company (uses the service-role client + the
 *  companyId from the form). Everyone else writes via the RLS client, which
 *  enforces they can only touch their own company. The companyId must be in the
 *  form data. */
export async function settingsContext(
  formData: FormData
): Promise<{ db: SupabaseClient; companyId: string }> {
  const { supabase, profile } = await requireUser();
  const companyId = formData.get("companyId")?.toString() ?? "";
  const db = (profile?.is_platform_admin ? createAdminClient() : supabase) as SupabaseClient;
  return { db, companyId };
}

/** Require a signed-in applicant; otherwise send to applicant sign-in. */
export async function requireApplicant(nextPath = "/portal") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/applicant/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return { supabase, user };
}

/** Require platform-admin (founder) access, else redirect appropriately. */
export async function requirePlatformAdmin() {
  const { supabase, user, profile } = await requireUser();
  if (!profile?.is_platform_admin) {
    const { data } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1);
    redirect(data && data.length > 0 ? "/dashboard" : "/no-access");
  }
  return { supabase, user, profile };
}
