import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  id: string;
  name: string;
  billing_status: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-red-100 text-red-700",
  canceled: "bg-gray-200 text-gray-600",
  incomplete: "bg-amber-100 text-amber-700",
  none: "bg-gray-100 text-gray-500",
};

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data: companies } = await db
    .from("companies")
    .select("id, name, billing_status, billing_interval, current_period_end, created_at")
    .order("name");
  const rows = (companies ?? []) as Row[];

  const paying = rows.filter((r) => r.billing_status === "active" || r.billing_status === "trialing").length;
  const mrr = rows.reduce((s, r) => {
    if (r.billing_status !== "active" && r.billing_status !== "trialing") return s;
    return s + (r.billing_interval === "year" ? 550 / 12 : 55);
  }, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Billing</h1>
      <p className="mt-1 text-sm text-white/80">Subscriptions across all companies.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Paying companies", value: paying.toString() },
          { label: "Est. MRR", value: "£" + Math.round(mrr).toLocaleString() },
          { label: "Total companies", value: rows.length.toString() },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
            <p className="text-xs text-white/70">{m.label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Renews</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => {
              const status = c.billing_status ?? "none";
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.none}`}>
                      {status === "none" ? "No subscription" : status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.billing_interval === "year" ? "£550 / yr" : c.billing_interval === "month" ? "£55 / mo" : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">No companies yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
