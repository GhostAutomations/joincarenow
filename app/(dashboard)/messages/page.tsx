import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { getStaffContacts } from "@/modules/staff-messages/actions";
import { StaffMessagesLive } from "@/components/dashboard/staff-messages-live";
import { StaffChat, type StaffChatMessage, type TagOption } from "@/components/dashboard/staff-chat";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { with: withId } = await searchParams;
  const { supabase, current, user } = await requireCompany();
  const contacts = await getStaffContacts();
  const nameOf = new Map(contacts.map((c) => [c.id, c]));

  // Conversation list data: my messages, grouped by the other person.
  const { data: myMsgs } = await supabase
    .from("staff_messages")
    .select("sender_id, recipient_id, body, created_at, read_at")
    .eq("company_id", current.company_id)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const last = new Map<string, { snippet: string; at: string }>();
  const unread = new Map<string, number>();
  for (const m of myMsgs ?? []) {
    const other = (m.sender_id === user.id ? m.recipient_id : m.sender_id) as string;
    if (!last.has(other)) last.set(other, { snippet: ((m.sender_id === user.id ? "You: " : "") + (m.body as string)).slice(0, 60), at: m.created_at as string });
    if (m.recipient_id === user.id && !m.read_at) unread.set(other, (unread.get(other) ?? 0) + 1);
  }
  // Left list = all contacts, ordered by most-recent conversation then name.
  const rows = contacts
    .map((c) => ({ ...c, ...(last.get(c.id) ?? { snippet: c.roleLabel, at: "" }), unread: unread.get(c.id) ?? 0 }))
    .sort((a, b) => (b.at || "").localeCompare(a.at || "") || a.name.localeCompare(b.name));

  // Right pane: the open conversation, if any.
  const active = withId && nameOf.get(withId) ? nameOf.get(withId)! : null;
  let messages: StaffChatMessage[] = [];
  let applicants: TagOption[] = [];
  if (active) {
    const [{ data: msgs }, { data: appsData }] = await Promise.all([
      supabase
        .from("staff_messages")
        .select("id, sender_id, application_id, body, created_at")
        .eq("company_id", current.company_id)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${active.id}),and(sender_id.eq.${active.id},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true }),
      supabase
        .from("applications")
        .select("id, applicants ( first_name, last_name ), jobs ( title )")
        .eq("company_id", current.company_id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appName = new Map<string, string>(((appsData ?? []) as any[]).map((a) => {
      const n = [a.applicants?.first_name, a.applicants?.last_name].filter(Boolean).join(" ") || "Applicant";
      return [a.id as string, `${n}${a.jobs?.title ? ` · ${a.jobs.title}` : ""}`];
    }));
    applicants = [...appName.entries()].map(([applicationId, name]) => ({ applicationId, name }));
    messages = (msgs ?? []).map((m) => ({
      id: m.id as string, mine: m.sender_id === user.id, body: m.body as string,
      at: m.created_at as string, applicant: m.application_id ? appName.get(m.application_id as string) ?? null : null,
    }));
    // Mark their messages to me as read.
    await supabase.from("staff_messages").update({ read_at: new Date().toISOString() })
      .eq("company_id", current.company_id).eq("recipient_id", user.id).eq("sender_id", active.id).is("read_at", null);
  }

  return (
    <div>
      <StaffMessagesLive />
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Messages</h1>
      <p className="mt-1 text-sm text-white/80">Private team chat — tag an applicant to add to their audit trail (applicants never see these).</p>

      <div className="mt-4 grid gap-3 lg:grid-cols-[300px_1fr]">
        {/* Left: contacts / conversations */}
        <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/15 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-white/15 px-4 py-3 text-sm font-semibold text-white">
            <MessagesSquare className="h-4 w-4 text-white/80" /> Team
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-white/70">No other team members yet. Invite colleagues in Settings → Team.</p>
          ) : (
            <ul className="max-h-[64vh] divide-y divide-white/10 overflow-y-auto">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/messages?with=${c.id}`} className={`flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 ${active?.id === c.id ? "bg-white/15" : ""}`}>
                    <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-semibold text-white">
                      {c.name.slice(0, 1).toUpperCase()}
                      {c.unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{c.unread}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{c.name}</p>
                      <p className={`truncate text-xs ${c.unread > 0 ? "font-medium text-white/90" : "text-white/60"}`}>{c.snippet}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: open chat */}
        <div>
          {active ? (
            <StaffChat recipientId={active.id} recipientName={active.name} messages={messages} applicants={applicants} />
          ) : (
            <div className="flex h-[70vh] flex-col items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-center shadow-sm backdrop-blur-md">
              <MessagesSquare className="h-10 w-10 text-white/40" />
              <p className="mt-2 text-sm text-white/70">{rows.length === 0 ? "Invite a colleague to start messaging." : "Select a team member to start chatting."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
