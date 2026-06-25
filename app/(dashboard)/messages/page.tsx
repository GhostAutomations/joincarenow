import Link from "next/link";
import { MessagesSquare, ChevronRight } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { getStaffContacts } from "@/modules/staff-messages/actions";
import { StaffMessagesLive } from "@/components/dashboard/staff-messages-live";

export default async function MessagesPage() {
  const { supabase, current, user } = await requireCompany();
  const contacts = await getStaffContacts();
  const nameOf = new Map(contacts.map((c) => [c.id, c]));

  const { data: msgs } = await supabase
    .from("staff_messages")
    .select("sender_id, recipient_id, body, created_at, read_at")
    .eq("company_id", current.company_id)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  // Group into conversations by the other person.
  const seen = new Set<string>();
  const convos: { id: string; name: string; role: string; snippet: string; at: string; unread: number }[] = [];
  const unreadBy = new Map<string, number>();
  for (const m of msgs ?? []) {
    const otherId = (m.sender_id === user.id ? m.recipient_id : m.sender_id) as string;
    if (m.recipient_id === user.id && !m.read_at) unreadBy.set(otherId, (unreadBy.get(otherId) ?? 0) + 1);
  }
  for (const m of msgs ?? []) {
    const otherId = (m.sender_id === user.id ? m.recipient_id : m.sender_id) as string;
    if (seen.has(otherId)) continue;
    const c = nameOf.get(otherId);
    if (!c) continue;
    seen.add(otherId);
    convos.push({
      id: otherId, name: c.name, role: c.roleLabel,
      snippet: ((m.sender_id === user.id ? "You: " : "") + (m.body as string)).slice(0, 80),
      at: m.created_at as string, unread: unreadBy.get(otherId) ?? 0,
    });
  }

  const others = contacts.filter((c) => !seen.has(c.id));

  return (
    <div>
      <StaffMessagesLive />
      <PageHeader title="Messages" subtitle="Private messages with your team. Tag an applicant to add to their audit trail — applicants never see these." />

      {convos.length > 0 && (
        <ul className="mt-5 space-y-2">
          {convos.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-gray-50">
                <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {c.name.slice(0, 1).toUpperCase()}
                  {c.unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{c.unread}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{c.name} <span className="font-normal text-gray-400">· {c.role}</span></p>
                    <span className="shrink-0 text-xs text-gray-400">{new Date(c.at).toLocaleDateString("en-GB")}</span>
                  </div>
                  <p className={`truncate text-xs ${c.unread > 0 ? "font-medium text-gray-700" : "text-gray-500"}`}>{c.snippet}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-white drop-shadow-sm"><MessagesSquare className="h-4 w-4" /> New message</p>
        {others.length === 0 && convos.length === 0 ? (
          <p className="mt-2 text-sm text-white/70">No other team members yet. Invite colleagues from Settings.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:bg-gray-50">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="truncate text-xs text-gray-500">{c.roleLabel}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
