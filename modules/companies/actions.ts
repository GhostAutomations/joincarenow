"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(120),
});

export type CompanyState = { error?: string } | undefined;

export async function createCompany(
  _prev: CompanyState,
  formData: FormData
): Promise<CompanyState> {
  const parsed = createCompanySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) return { error: "Company name must contain letters or numbers" };

  // Try base slug, then suffixed variants if taken.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { error } = await supabase.rpc("create_company", {
      company_name: parsed.data.name,
      company_slug: slug,
    });

    if (!error) redirect("/dashboard");
    if (!error.message.includes("duplicate key")) {
      return { error: "Could not create company. Please try again." };
    }
  }
  return { error: "Could not generate a unique web address. Try a different name." };
}
