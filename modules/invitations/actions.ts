"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { COMPANY_ROLE_LABEL } from "@/lib/roles";

/** Build an absolute accept-invite URL from the incoming request host. */
async function acceptUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "joincarenow.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/accept-invite?token=${token}`;
}

/** Send the branded invitation email (CTA button only — no plain-text link).
 *  Used on both first send and Resend. Returns whether it went out. */
async function sendInviteEmail(
  db: Awaited<ReturnType<typeof createClient>>,
  opts: { companyId: string; email: string; name?: string | null; role: string; token: string }
): Promise<boolean> {
  const { data: company } = await db
    .from("companies")
    .select("name")
    .eq("id", opts.companyId)
    .maybeSingle();
  const companyName = (company as { name?: string } | null)?.name ?? "your team";
  const firstName = (opts.name ?? "").trim().split(" ")[0] || "there";
  const roleLabel = COMPANY_ROLE_LABEL[opts.role] ?? "team member";
  const link = await acceptUrl(opts.token);

  const res = await sendBrandedEmail(db, opts.companyId, {
    to: opts.email,
    subject: `You've been invited to join ${companyName} on Join Care Now`,
    text:
      `Hi ${firstName},\n\n` +
      `You've been invited to join ${companyName} on Join Care Now as a ${roleLabel}.\n\n` +
      `Use the button below to set your password and get started.\n\n` +
      `The Join Care Now team`,
    cta: { label: "Accept your invitation", url: link },
  });
  return res.ok;
}

// ---------- Create invitation (founder→admin, admin→manager/recruiter) ----------

const inviteSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["admin", "manager", "recruiter"]),
});

export type InviteState =
  | { error?: string; invitedEmail?: string; emailSent?: boolean }
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

  // Auto-send the invite email for team members (manager/recruiter). Founder→admin
  // invites stay manual on purpose — the founder controls that send via the
  // "account ready" / "Notify the customer" flow once setup is complete.
  let emailSent = false;
  if (parsed.data.role !== "admin") {
    emailSent = await sendInviteEmail(supabase, {
      companyId: parsed.data.companyId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      token: data.token,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/founder");
  return { invitedEmail: parsed.data.email, emailSent };
}

// ---------- Resend invitation email (team invites) ----------

export type ResendState = { ok?: boolean; error?: string } | undefined;

/** Re-send the invite email for a pending invitation. Company-admin only;
 *  scoped to their own company via RLS. */
export async function resendInvitation(
  _prev: ResendState,
  formData: FormData
): Promise<ResendState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing invitation." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // RLS only returns invitations for companies the caller belongs to.
  const { data: inv } = await supabase
    .from("invitations")
    .select("company_id, email, role, token, invited_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return { error: "Invitation not found." };
  if ((inv as { status: string }).status !== "pending")
    return { error: "This invitation is no longer pending." };

  // Only a company admin may resend.
  const { data: membership } = await supabase
    .from("company_users")
    .select("role")
    .eq("company_id", (inv as { company_id: string }).company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if ((membership as { role?: string } | null)?.role !== "admin")
    return { error: "Only a company admin can resend invitations." };

  const i = inv as { company_id: string; email: string; role: string; token: string; invited_name: string | null };
  const ok = await sendInviteEmail(supabase, {
    companyId: i.company_id,
    email: i.email,
    name: i.invited_name,
    role: i.role,
    token: i.token,
  });

  revalidatePath("/settings");
  return ok ? { ok: true } : { error: "Couldn't send the email — please try again." };
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
