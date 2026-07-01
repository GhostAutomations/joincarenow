import Link from "next/link";
import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react";
import { requireApplicant } from "@/modules/auth/queries";
import { cleanMessageBody } from "@/lib/comms/clean";
import { PortalLive } from "@/components/portal/portal-live";

type MyApp = { application_id: string; job_title: string; company_name: string };

export default async function PortalConversationsPage() {
  const { supabase } = await requireApplicant("/portal/conversations");

  const [{ data: apps }, { data: msgs }] = await Promise.all([
    supabase.rpc("get_my_applications"),
    supabase
      .from("messages")
      .select("application_id, body, direction, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const appMap = new Map(((apps ?? []) as MyApp[]).map((a) => [a.application_id, a]));

  // One conversation per application that has messages — newest first.
  const seen = new Set<string>();
  const convos: { id: string; company: string; job: string; snippet: string; at: string }[] = [];
  for (const m of msgs ?? []) {
    const appId = m.application_id as string;
    if (!appId || seen.has(appId)) continue;
    const a = appMap.get(appId);
    if (!a) continue;
    seen.add(appId);
    convos.push({
      id: appId,
      company: a.company_name,
      job: a.job_title,
      snippet: (m.direction === "outbound" ? cleanMessageBody(m.body as string) : (m.body as string)).slice(0, 80),
      at: m.created_at as string,
    });
  }

  return (
    <main className="min-h-screen bg-white">
      <PortalLive />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Back to portal
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
        </div>

        {convos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            No messages yet. When a company messages you, it&apos;ll appear here.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {convos.map((c) => (
              <li key={c.id}>
                <Link href={`/portal/conversations/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-white/60">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {c.company.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{c.company}</p>
                      <span className="shrink-0 text-xs text-gray-400">{new Date(c.at).toLocaleDateString("en-GB")}</span>
                    </div>
                    <p className="truncate text-xs text-gray-500">{c.snippet || c.job}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
