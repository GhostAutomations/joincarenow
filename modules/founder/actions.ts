"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, ACTING_COMPANY_COOKIE } from "@/modules/auth/queries";

/** Founder: start "managing as" a company — drops into that company's real
 *  dashboard with all its tools. */
export async function manageAsCompany(formData: FormData) {
  const { profile } = await requireUser();
  if (!profile?.is_platform_admin) return;
  const companyId = formData.get("companyId")?.toString();
  if (!companyId) return;
  (await cookies()).set(ACTING_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  redirect("/dashboard");
}

/** Founder: stop managing as a company and return to the Founder console. */
export async function stopManaging() {
  (await cookies()).delete(ACTING_COMPANY_COOKIE);
  redirect("/admin/companies");
}
