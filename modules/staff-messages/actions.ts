"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { COMPANY_ROLE_LABEL } from "@/lib/roles";

export type StaffMsgState = { error?: string; ok?: boolean } | undefined;

export type Contact = { id: string; name: string; email: string; role: string; roleLabel: string };

/** Everyone in the company you can message (recruiter level and up = all staff),
 *  excluding yourself. */
export async function getStaffContacts(): Promise<Contact[]> {
  const { supabase, current, user } = await requireCompany();
  const { data } = await supabase
    .from("company_users")
    .select("user_id, role, profiles ( full_name, email )")
    .eq("company_id", current.company_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .filter((r) => r.user_id !== user.id)
    .map((r) => ({
      id: r.user_id as string,
      name: (r.profiles?.full_name as string) || (r.profiles?.email as string) || "Team member",
      email: (r.profiles?.email as string) ?? "",
      role: r.role as string,
      roleLabel: COMPANY_ROLE_LABEL[r.role as string] ?? r.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Send an internal message to a colleague, optionally tagged to an applicant. */
export async function sendStaffMessage(_prev: StaffMsgState, formData: FormData): Promise<StaffMsgState> {
  const recipientId = formData.get("recipientId")?.toString();
  const body = (formData.get("body")?.toString() ?? "").trim();
  const applicationId = formData.get("applicationId")?.toString() || null;
  if (!recipientId) return { error: "Choose who to message." };
  if (body.length < 1) return { error: "Write a message first." };

  const { supabase, current, user } = await requireCompany();

  // Recipient must be a member of the same company.
  const { data: member } = await supabase
    .from("company_users").select("user_id").eq("company_id", current.company_id).eq("user_id", recipientId).maybeSingle();
  if (!member) return { error: "That person isn't on your team." };

  // If tagging an applicant, the application must belong to this company.
  let appId: string | null = null;
  if (applicationId) {
    const { data: app } = await supabase
      .from("applications").select("id").eq("id", applicationId).eq("company_id", current.company_id).maybeSingle();
    appId = app?.id ?? null;
  }

  const { error } = await supabase.from("staff_messages").insert({
    company_id: current.company_id,
    sender_id: user.id,
    recipient_id: recipientId,
    application_id: appId,
    body: body.slice(0, 5000),
  });
  if (error) return { error: "Could not send the message." };

  revalidatePath("/messages");
  revalidatePath(`/messages/${recipientId}`);
  if (appId) revalidatePath("/pipeline");
  return { ok: true };
}

export type TeamMsg = { id: string; sender: string; recipient: string; body: string; at: string };

/** Internal staff messages tagged to an applicant (their audit trail — staff
 *  only). Applicants never see these (no applicant RLS on staff_messages). */
export async function getApplicantTeamMessages(applicationId: string): Promise<TeamMsg[]> {
  const { supabase, current } = await requireCompany();
  const [{ data: msgs }, { data: members }] = await Promise.all([
    supabase
      .from("staff_messages")
      .select("id, sender_id, recipient_id, body, created_at")
      .eq("company_id", current.company_id)
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true }),
    supabase.from("company_users").select("user_id, profiles ( full_name, email )").eq("company_id", current.company_id),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = new Map<string, string>(((members ?? []) as any[]).map((m) => [m.user_id as string, (m.profiles?.full_name as string) || (m.profiles?.email as string) || "Team member"]));
  return (msgs ?? []).map((m) => ({
    id: m.id as string,
    sender: name.get(m.sender_id as string) ?? "Team member",
    recipient: name.get(m.recipient_id as string) ?? "Team member",
    body: m.body as string,
    at: m.created_at as string,
  }));
}

/** Mark all messages from a colleague to me as read. */
export async function markStaffThreadRead(otherUserId: string): Promise<void> {
  const { supabase, current, user } = await requireCompany();
  await supabase
    .from("staff_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", current.company_id)
    .eq("recipient_id", user.id)
    .eq("sender_id", otherUserId)
    .is("read_at", null);
  revalidatePath("/messages");
}
