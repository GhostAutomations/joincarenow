import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { ExportPdfLink } from "@/components/dashboard/export-pdf-link";

const FUNNEL = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired"] as const;
const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview: "Interview",
  right_to_work: "Right to work",
  offer: "Offer",
  hired: "Hired",
};
const RANGES: Record<string, { label: string; days: number | null }> = {
  "30": { label: "30 days", days: 30 },
  "90": { label: "90 days", days: 90 },
  "365": { label: "12 months", days: 365 },
  all: { label: "All time", days: null },
};

type AppRow = { company_id: string; stage: string; created_at: string };

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const { range: rangeParam } = await searchParams;
  const range = RANGES[rangeParam ?? "90"] ? (rangeParam ?? "90") : "90";
  const cutoffIso = RANGES[range].days ? new Date(Date.now() - RANGES[range].days! * 86400e3).toISOString() : null;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);

  let appsQ = db.from("applications").select("company_id, stage, created_at");
  if (cutoffIso) appsQ = appsQ.gte("created_at", cutoffIso);

  const [{ data: companies }, { data: apps }, { data: jobs }, { data: msgs }] = await Promise.all([
    db.from("companies").select("id, name, billing_status, billing_comped, agreed_plan").order("name"),
    appsQ,
    db.from("jobs").select("company_id, status"),
    db.from("messages").select("company_id, channel").eq("direction", "outbound").gte("created_at", monthStart),
  ]);

  const appRows = (apps ?? []) as AppRow[];

  // Platform totals + funnel.
  const total = appRows.length;
  const byStage = new Map<string, number>();
  for (const r of appRows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  const sc = (s: string) => byStage.get(s) ?? 0;
  const hired = sc("hired");
  const conversion = total > 0 ? Math.round((hired / total) * 100) : 0;
  const funnelMax = Math.max(1, ...FUNNEL.map(sc));

  // Per-company aggregation.
  type Agg = { apps: number; active: number; hired: number; live: number; msgs: number; lastActive: string | null };
  const agg = new Map<string, Agg>();
  const ensure = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) { a = { apps: 0, active: 0, hired: 0, live: 0, msgs: 0, lastActive: null }; agg.set(id, a); }
    return a;
  };
  for (const r of appRows) {
    const a = ensure(r.company_id);
    a.apps += 1;
    if (r.stage === "hired") a.hired += 1;
    else if (r.stage !== "rejected") a.active += 1;
    if (!a.lastActive || r.created_at > a.lastActive) a.lastActive = r.created_at;
  }
  for (const j of jobs ?? []) if (j.status === "published") ensure(j.company_id as string).live += 1;
  for (const m of msgs ?? []) ensure(m.company_id as string).msgs += 1;

  const companyRows = (companies ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    paying:
      c.billing_comped === true
        ? "Comp"
        : c.agreed_plan === "diamond"
        ? "Diamond"
        : c.billing_status === "active" || c.billing_status === "trialing"
        ? "Paying"
        : "—",
    ...(agg.get(c.id as string) ?? { apps: 0, active: 0, hired: 0, live: 0, msgs: 0, lastActive: null }),
  }));
  companyRows.sort((a, b) => b.apps - a.apps);

  const totals = {
    companies: companies?.length ?? 0,
    apps: total,
    hired,
    live: companyRows.reduce((s, r) => s + r.live, 0),
    msgs: companyRows.reduce((s, r) => s + r.msgs, 0),
  };

  const stat = (label: string, value: number | string, sub?: string) => (
    <div className="rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
      <p className="text-sm text-white/70">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/60">{sub}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Statistics</h1>
      <p className="mt-1 text-sm text-white/80">Platform-wide recruitment activity across every company.</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(RANGES).map(([key, r]) => (
            <Link key={key} href={`/founder/statistics?range=${key}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${range === key ? "bg-white text-brand-700" : "bg-white/20 text-white hover:bg-white/30"}`}>
              {r.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <ExportCsvButton
            filename={`platform-companies-${range}.csv`}
            rows={companyRows.map((c) => ({
              Company: c.name,
              Billing: c.paying,
              Applications: c.apps,
              Active: c.active,
              Hires: c.hired,
              "Live jobs": c.live,
              "Messages (month)": c.msgs,
              "Last active": c.lastActive ? new Date(c.lastActive).toLocaleDateString("en-GB") : "",
            }))}
          />
          <ExportPdfLink href={`/api/report/pdf?type=platform&range=${range}`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-white sm:grid-cols-3 lg:grid-cols-5">
        {stat("Companies", totals.companies)}
        {stat("Applications", totals.apps)}
        {stat("Hires", totals.hired, `${conversion}% conversion`)}
        {stat("Live jobs", totals.live)}
        {stat("Messages (month)", totals.msgs)}
      </div>

      {/* Platform funnel */}
      <div className="mt-4 rounded-2xl border border-white/25 bg-white/15 p-4 text-white backdrop-blur-md">
        <p className="text-sm font-semibold">Platform recruitment funnel</p>
        <div className="mt-3 space-y-2">
          {FUNNEL.map((s) => {
            const cnt = sc(s);
            const pct = Math.round((cnt / funnelMax) * 100);
            return (
              <div key={s} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-white/80">{STAGE_LABEL[s]}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/15">
                  <div className="flex h-full items-center rounded-md bg-white/80 px-2" style={{ width: `${Math.max(pct, cnt > 0 ? 8 : 0)}%` }}>
                    {cnt > 0 && <span className="text-[11px] font-semibold text-brand-700">{cnt}</span>}
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-white/70">{total > 0 ? Math.round((cnt / total) * 100) : 0}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-company table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-2 py-2.5 font-medium">Billing</th>
              <th className="px-2 py-2.5 text-right font-medium">Apps</th>
              <th className="px-2 py-2.5 text-right font-medium">Active</th>
              <th className="px-2 py-2.5 text-right font-medium">Hires</th>
              <th className="px-2 py-2.5 text-right font-medium">Live jobs</th>
              <th className="px-2 py-2.5 text-right font-medium">Msgs (mo)</th>
              <th className="px-4 py-2.5 text-right font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companyRows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/founder/companies/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600 hover:underline">{c.name}</Link>
                </td>
                <td className="px-2 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.paying === "Paying" ? "bg-green-100 text-green-700" : c.paying === "Diamond" ? "bg-indigo-100 text-indigo-700" : c.paying === "Comp" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-400"}`}>{c.paying}</span>
                </td>
                <td className="px-2 py-2.5 text-right text-gray-700">{c.apps}</td>
                <td className="px-2 py-2.5 text-right text-gray-700">{c.active}</td>
                <td className="px-2 py-2.5 text-right text-gray-700">{c.hired}</td>
                <td className="px-2 py-2.5 text-right text-gray-700">{c.live}</td>
                <td className="px-2 py-2.5 text-right text-gray-700">{c.msgs}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {c.lastActive ? new Date(c.lastActive).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                </td>
              </tr>
            ))}
            {companyRows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">No companies yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
