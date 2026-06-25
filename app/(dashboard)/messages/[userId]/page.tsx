import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { StaffChat, type StaffChatMessage, type TagOption } from "@/components/dashboard/staff-chat";
import { StaffMessagesLive } from "@/components/dashboard/staff-messages-live";

export default async function StaffThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { supabase, current, user } = await requireCompany();

  // The other person must be on this team.
  const { data: member } = await supabase
    .from("company_users")
    .select("user_id, profiles ( full_name, email )")
    .eq("company_id", current.company_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prof = (member as any).profiles;
  const otherName = prof?.full_name || prof?.email || "Team member";

  const { data: msgs } = await supabase
    .from("staff_messages")
    .select("id, sender_id, recipient_id, application_id, body, created_at")
    .eq("company_id", current.company_id)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  // Applicants for the tag dropdown + names for tagged messages.
  const { data: appsData } = await supabase
    .from("applications")
    .select("id, applicants ( first_name, last_name ), jobs ( title )")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false })
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appName = new Map<string, string>(((appsData ?? []) as any[]).map((a) => {
    const n = [a.applicants?.first_name, a.applicants?.last_name].filter(Boolean).join(" ") || "Applicant";
    const job = a.jobs?.title ? ` · ${a.jobs.title}` : "";
    return [a.id as string, `${n}${job}`];
  }));
  const applicants: TagOption[] = [...appName.entries()].map(([applicationId, name]) => ({ applicationId, name }));

  const messages: StaffChatMessage[] = (msgs ?? []).map((m) => ({
    id: m.id as string,
    mine: m.sender_id === user.id,
    body: m.body as string,
    at: m.created_at as string,
    applicant: m.application_id ? appName.get(m.application_id as string) ?? null : null,
  }));

  // Mark their messages to me as read.
  await supabase
    .from("staff_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", current.company_id)
    .eq("recipient_id", user.id)
    .eq("sender_id", userId)
    .is("read_at", null);

  return (
    <div className="mx-auto max-w-2xl">
      <StaffMessagesLive />
      <Link href="/messages" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Messages
      </Link>
      <h1 className="mt-2 mb-3 text-xl font-semibold text-white drop-shadow-sm">{otherName}</h1>
      <StaffChat recipientId={userId} recipientName={otherName} messages={messages} applicants={applicants} />
    </div>
  );
}
