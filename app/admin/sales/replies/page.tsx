import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function RepliesPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("prospect_activities")
    .select("id, prospect_company_id, channel, body, created_at, prospect_companies(name), prospect_contacts(name, email, phone)")
    .eq("type", "message")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replies = (data ?? []) as any[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/sales" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Replies</h1>
      <p className="mt-1 text-sm text-white/80">Inbound email &amp; SMS from prospects. Open the record to respond.</p>

      <div className="mt-4 space-y-2">
        {replies.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
            No replies yet.
          </div>
        )}
        {replies.map((r) => (
          <Link
            key={r.id}
            href={`/admin/sales/${r.prospect_company_id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {r.channel === "sms" ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              <span className="font-medium text-gray-700">{r.prospect_companies?.name ?? "—"}</span>
              <span>· {r.prospect_contacts?.name || r.prospect_contacts?.email || r.prospect_contacts?.phone || "—"}</span>
              <span className="ml-auto">{new Date(r.created_at).toLocaleString("en-GB")}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-gray-800">{r.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
