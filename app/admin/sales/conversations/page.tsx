import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Msg = {
  prospect_company_id: string;
  channel: string | null;
  direction: string | null;
  body: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospect_companies: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospect_contacts: any;
};

export default async function ConversationsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("prospect_activities")
    .select("prospect_company_id, channel, direction, body, created_at, prospect_companies(name), prospect_contacts(name, email, phone)")
    .eq("type", "message")
    .order("created_at", { ascending: false })
    .limit(500);
  const msgs = (data ?? []) as Msg[];

  // One row per prospect — latest message + count.
  const seen = new Map<string, { latest: Msg; count: number }>();
  for (const m of msgs) {
    const cur = seen.get(m.prospect_company_id);
    if (cur) cur.count += 1;
    else seen.set(m.prospect_company_id, { latest: m, count: 1 });
  }
  const threads = [...seen.values()];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/sales" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Conversations</h1>
      <p className="mt-1 text-sm text-white/80">Every prospect you&apos;ve messaged. Open one to see the full thread and reply.</p>

      <div className="mt-4 space-y-2">
        {threads.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No conversations yet.
          </div>
        )}
        {threads.map(({ latest: m, count }) => {
          const inbound = m.direction === "inbound";
          return (
            <Link
              key={m.prospect_company_id}
              href={`/admin/sales/${m.prospect_company_id}`}
              className="block rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {m.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                <span className="font-medium text-gray-800">{m.prospect_companies?.name ?? "—"}</span>
                <span>· {m.prospect_contacts?.name || m.prospect_contacts?.email || m.prospect_contacts?.phone || "—"}</span>
                {inbound && <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">replied</span>}
                <span className="ml-auto">{count} message{count === 1 ? "" : "s"} · {new Date(m.created_at).toLocaleString("en-GB")}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-gray-800">
                <span className="text-gray-400">{inbound ? "Them: " : "You: "}</span>{m.body}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
