import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";

type Row = {
  id: string;
  name: string;
  billing_status: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  commitment_until: string | null;
  extra_branches: number | null;
  billing_comped: boolean | null;
  stripe_customer_id: string | null;
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

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string }>;
}) {
  await requirePlatformAdmin();
  const { q, status: statusFilter, plan: planFilter } = await searchParams;
  const db = createAdminClient();

  const [{ data: companies }, { data: usage }] = await Promise.all([
    db.from("companies")
      .select("id, name, billing_status, billing_interval, current_period_end, commitment_until, extra_branches, billing_comped, stripe_customer_id, created_at")
      .order("name"),
    db.from("usage_events").select("company_id, kind, quantity").gte("created_at", monthStartIso()),
  ]);
  const allRows = (companies ?? []) as Row[];

  const usageMap = new Map<string, { sms: number; ai: number }>();
  for (const u of usage ?? []) {
    const cur = usageMap.get(u.company_id as string) ?? { sms: 0, ai: 0 };
    if (u.kind === "sms") cur.sms += (u.quantity as number) ?? 0;
    if (u.kind === "ai") cur.ai += (u.quantity as number) ?? 0;
    usageMap.set(u.company_id as string, cur);
  }

  const now = new Date();
  const isPaying = (r: Row) => (r.billing_status === "active" || r.billing_status === "trialing") && !r.billing_comped;
  const comped = (r: Row) => r.billing_comped === true;
  const committed = (r: Row) => !!r.commitment_until && new Date(r.commitment_until) > now;
  const planType = (r: Row): "none" | "comped" | "annual" | "committed" | "monthly" => {
    if (comped(r)) return "comped";
    if (!isPaying(r)) return "none";
    if (r.billing_interval === "year") return "annual";
    if (committed(r)) return "committed";
    return "monthly";
  };

  // Filters.
  const term = (q ?? "").trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (term && !r.name.toLowerCase().includes(term)) return false;
    if (statusFilter && (r.billing_status ?? "none") !== statusFilter) return false;
    if (planFilter && planType(r) !== planFilter) return false;
    return true;
  });

  // Metrics + revenue breakdown (over ALL companies).
  const mrr = allRows.reduce((s, r) => (isPaying(r) ? s + (r.billing_interval === "year" ? 550 / 12 : 55) + (r.extra_branches ?? 0) * 7.5 : s), 0);
  const paying = allRows.filter(isPaying).length;
  const onCommitment = allRows.filter((r) => isPaying(r) && committed(r)).length;
  const pastDue = allRows.filter((r) => r.billing_status === "past_due").length;
  const compedCount = allRows.filter(comped).length;
  const monthlyCount = allRows.filter((r) => planType(r) === "monthly").length;
  const annualCount = allRows.filter((r) => planType(r) === "annual").length;

  const money = (n: number) => "£" + Math.round(n).toLocaleString();
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  const metrics = [
    { label: "MRR", value: money(mrr) },
    { label: "ARR", value: money(mrr * 12) },
    { label: "Paying", value: paying.toString() },
    { label: "On commitment", value: onCommitment.toString() },
    { label: "Past due", value: pastDue.toString() },
  ];

  const csvRows = rows.map((r) => {
    const u = usageMap.get(r.id) ?? { sms: 0, ai: 0 };
    return {
      Company: r.name,
      Status: comped(r) ? "complimentary" : r.billing_status ?? "none",
      Plan: planType(r),
      Renews: date(r.current_period_end),
      Commitment: committed(r) ? date(r.commitment_until) : r.billing_interval === "year" ? "annual term" : "",
      Branches: 1 + (r.extra_branches ?? 0),
      SMS: u.sms,
      AI: u.ai,
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Billing</h1>
      <p className="mt-1 text-sm text-white/80">Subscriptions and revenue across all companies.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md">
            <p className="text-xs text-white/70">{m.label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by plan */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {[
          ["Monthly", monthlyCount],
          ["Annual", annualCount],
          ["12-month", onCommitment],
          ["Complimentary", compedCount],
        ].map(([label, n]) => (
          <span key={label as string} className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-medium text-white/90">
            {label}: {n as number}
          </span>
        ))}
      </div>

      {/* Filters + export */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="Search company…" className="w-52 rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900" />
          <select name="status" defaultValue={statusFilter ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
            <option value="none">No subscription</option>
          </select>
          <select name="plan" defaultValue={planFilter ?? ""} className="rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900">
            <option value="">All plans</option>
            <option value="monthly">Monthly</option>
            <option value="committed">12-month</option>
            <option value="annual">Annual</option>
            <option value="comped">Complimentary</option>
            <option value="none">No plan</option>
          </select>
          <button className="rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30">Filter</button>
          {(q || statusFilter || planFilter) && <Link href="/admin/billing" className="text-sm text-white/70 hover:text-white">Clear</Link>}
        </form>
        <div className="ml-auto"><ExportCsvButton rows={csvRows} /></div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Renews / commitment</th>
              <th className="px-4 py-3 text-right">Branches</th>
              <th className="px-4 py-3 text-right">SMS / AI (mo)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => {
              const status = comped(c) ? "complimentary" : c.billing_status ?? "none";
              const u = usageMap.get(c.id) ?? { sms: 0, ai: 0 };
              const pt = planType(c);
              const planLabel = pt === "comped" ? "Complimentary" : pt === "annual" ? "£550 / yr" : pt === "committed" ? "£55 / mo · 12-mo" : pt === "monthly" ? "£55 / mo" : "—";
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <a href={`/admin/billing/${c.id}`} className="hover:text-brand-700 hover:underline">{c.name}</a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${comped(c) ? "bg-violet-100 text-violet-700" : STATUS_BADGE[status] ?? STATUS_BADGE.none}`}>
                      {status === "none" ? "No subscription" : status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{planLabel}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {date(c.current_period_end)}
                    {committed(c) && <span className="block text-xs text-brand-700">committed to {date(c.commitment_until)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{1 + (c.extra_branches ?? 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{u.sms} / {u.ai}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">No companies match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-white/60">
        MRR includes base plan + extra branches (annual as monthly equivalent); variable SMS/AI usage and complimentary accounts are excluded.
      </p>
    </div>
  );
}
