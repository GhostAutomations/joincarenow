import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { RequestQuote } from "@/components/dashboard/request-quote";

type Row = {
  id: string;
  title: string;
  body: string;
  status: string;
  quote_amount: string | null;
  quote_note: string | null;
  created_at: string;
  companies: { name: string | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  quoted: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-gray-200 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Needs quote",
  quoted: "Quoted",
  accepted: "Accepted",
  declined: "Declined",
};

export default async function AdminRequestsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("feature_requests")
    .select("id, title, body, status, quote_amount, quote_note, created_at, companies(name), profiles:author_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(300);
  const items = (data ?? []) as unknown as Row[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Feature requests</h1>
      <p className="mt-1 text-sm text-white/80">Requests from company admins. Add a quote; they accept or decline.</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
            No requests yet.
          </div>
        )}
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-500">
                  {r.companies?.name ?? "—"} · {r.profiles?.full_name || r.profiles?.email || "Unknown"} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.body}</p>

            {r.status === "accepted" || r.status === "declined" ? (
              <p className="mt-3 rounded-lg bg-gray-50 p-2.5 text-sm text-gray-700">
                Quote {r.quote_amount ?? "—"} — <span className="font-medium">{STATUS_LABEL[r.status]}</span> by the company.
              </p>
            ) : (
              <RequestQuote id={r.id} amount={r.quote_amount} note={r.quote_note} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
