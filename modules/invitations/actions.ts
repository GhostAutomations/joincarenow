"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Build an absolute accept-invite URL from the incoming request host. */
async function acceptUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "joincarenow.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/accept-invite?token=${token}`;
}

// ---------- Create invitation (founder→admin, admin→manager/recruiter) ----------

const inviteSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["admin", "manager", "recruiter"]),
});

export type InviteState =
  | { error?: string; inviteLink?: string; invitedEmail?: string }
  | undefined;

export async function createInvitation(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_company_id: parsed.data.companyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_name: parsed.data.name,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/founder");
  return {
    inviteLink: await acceptUrl(data.token),
    invitedEmail: parsed.data.email,
  };
}

// ---------- Revoke invitation ----------

export async function revokeInvitation(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_id: id });

  revalidatePath("/settings");
  revalidatePath("/founder");
}

// ---------- Accept invitation: existing signed-in user ----------

export async function acceptAsCurrentUser(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    redirect(`/accept-invite?token=${token}&error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}

// ---------- Accept invitation: brand-new user (sets name + password) ----------

const acceptNewSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(2, "Enter your full name").max(120),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AcceptState = { error?: string } | undefined;

export async function acceptAsNewUser(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const parsed = acceptNewSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  // The invitation is the source of truth for the email — never trust a
  // client-supplied address. accept_invitation re-checks the match too.
  const { data: invite } = await supabase
    .rpc("get_invitation", { p_token: parsed.data.token })
    .maybeSingle<{
      email: string;
      role: string;
      company_name: string;
      status: string;
      is_expired: boolean;
    }>();

  if (!invite || invite.status !== "pending" || invite.is_expired) {
    return { error: "This invitation is no longer valid." };
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (signUpError) {
    if (/registered/i.test(signUpError.message)) {
      return { error: "You already have an account — please sign in to accept." };
    }
    return { error: signUpError.message };
  }

  const { error: acceptError } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
  });
  if (acceptError) return { error: acceptError.message };

  redirect("/dashboard");
}
