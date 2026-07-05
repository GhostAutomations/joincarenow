"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { seedCompanyStarter } from "@/lib/setup/seed";
import { selfServeEnabled } from "@/lib/flags";

const schema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(120),
  providerRef: z.string().trim().max(120).optional(),
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agree: z.literal("on", { errorMap: () => ({ message: "Please accept the terms to continue" }) }),
});

export type SignupState = { error?: string } | undefined;

/** Public self-serve company signup: create the admin account, create their
 *  company, make them its admin, and seed the starter pack. Gated by the
 *  SELF_SERVE_SIGNUP flag until the entity + terms are live. */
export async function selfServeSignUp(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  if (!selfServeEnabled()) return { error: "Self-serve signup is not available yet." };

  const parsed = schema.safeParse({
    companyName: formData.get("companyName"),
    providerRef: formData.get("providerRef") ?? undefined,
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    agree: formData.get("agree"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const baseSlug = slugify(parsed.data.companyName);
  if (!baseSlug) return { error: "Company name must contain letters or numbers." };

  const supabase = await createClient();

  // 1. Create the admin's auth account (a session is established on signup).
  const { error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (signUpError) {
    if (/registered/i.test(signUpError.message)) {
      return { error: "You already have an account — please sign in instead." };
    }
    return { error: signUpError.message };
  }

  // 2. Create the company + link this user as its admin (retry slug if taken).
  let companyId: string | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.rpc("self_serve_create_company", {
      p_name: parsed.data.companyName,
      p_slug: slug,
      p_provider_ref: parsed.data.providerRef ?? null,
    });
    if (!error) {
      companyId = data as string;
      break;
    }
    lastError = error.message;
    if (!/duplicate key/i.test(error.message)) {
      return { error: error.message || "Could not create your company. Please try again." };
    }
  }
  if (!companyId) {
    return { error: lastError || "Could not generate a unique web address. Try a different company name." };
  }

  // 3. Seed the turnkey starter pack (best-effort — never block signup).
  try {
    await seedCompanyStarter(companyId);
  } catch {
    /* the admin can re-apply the starter pack from setup */
  }

  // Land in the existing setup/billing gate (holds until activation).
  redirect("/dashboard");
}
