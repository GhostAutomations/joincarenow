import Link from "next/link";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { OnboardingTaskReview, type OnbTask } from "@/components/dashboard/onboarding-task-review";
import { ShieldCheck } from "lucide-react";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { ExportPdfLink } from "@/components/dashboard/export-pdf-link";

type TaskRow = OnbTask & {
  applicant_id: string;
  applicants: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

type AppRow = { stage: string; created_at: string; hired_at: string | null; job_id: string };

const STAGE_ORDER = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired", "rejected"] as const;
const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview: "Interview",
  right_to_work: "Right to work",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not progressing",
};
// Funnel = the progression stages (exclude "rejected", shown separately).
const FUNNEL = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired"] as const;

const RANGES: Record<string, { label: string; days: number | null }> = {
  "30": { label: "30 days", days: 30 },
  "90": { label: "90 days", days: 90 },
  "365": { label: "12 months", days: 365 },
  all: { label: "All time", days: null },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase, current } = await requireCompany();
  const { range: rangeParam } = await searchParams;
  const range = RANGES[rangeParam ?? "90"] ? (rangeParam ?? "90") : "90";
  const cutoffIso = RANGES[range].days ? new Date(Date.now() - RANGES[range].days! * 86400e3).toISOString() : null;

  // --- Recruitment data ---
  let appsQuery = supabase
    .from("applications")
    .select("stage, created_at, hired_at, job_id")
    .eq("company_id", current.company_id);
  if (cutoffIso) appsQuery = appsQuery.gte("created_at", cutoffIso);
  const [{ data: apps }, { data: jobs }, { data: branches }] = await Promise.all([
    appsQuery,
    supabase.from("jobs").select("id, title, branch_id").eq("company_id", current.company_id),
    supabase.from("branches").select("id, name").eq("company_id", current.company_id),
  ]);

  const rows = (apps ?? []) as AppRow[];
  const jobMap = new Map((jobs ?? []).map((j) => [j.id as string, { title: j.title as string, branchId: (j.branch_id as string) ?? null }]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id as string, b.name as string]));

  const total = rows.length;
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  const stageCount = (s: string) => byStage.get(s) ?? 0;

  const hiredRows = rows.filter((r) => r.stage === "hired");
  const hired = hiredRows.length;
  const rejected = stageCount("rejected");
  const active = total - hired - rejected;
  const conversion = total > 0 ? Math.round((hired / total) * 100) : 0;

  // Average time-to-hire (days) for hired applications with a hired_at.
  const tthDays = hiredRows
    .filter((r) => r.hired_at)
    .map((r) => (new Date(r.hired_at!).getTime() - new Date(r.created_at).getTime()) / 86400e3)
    .filter((d) => d >= 0);
  const avgTth = tthDays.length ? Math.round(tthDays.reduce((a, b) => a + b, 0) / tthDays.length) : null;

  const funnelMax = Math.max(1, ...FUNNEL.map(stageCount));

  // Per-job and per-branch breakdowns.
  type Agg = { apps: number; hired: number };
  const perJob = new Map<string, Agg & { title: string }>();
  const perBranch = new Map<string, Agg>();
  for (const r of rows) {
    const job = jobMap.get(r.job_id);
    const jKey = r.job_id;
    const je = perJob.get(jKey) ?? { apps: 0, hired: 0, title: job?.title ?? "Unknown job" };
    je.apps += 1;
    if (r.stage === "hired") je.hired += 1;
    perJob.set(jKey, je);

    const bName = job?.branchId ? branchMap.get(job.branchId) ?? "Unassigned" : "Unassigned";
    const be = perBranch.get(bName) ?? { apps: 0, hired: 0 };
    be.apps += 1;
    if (r.stage === "hired") be.hired += 1;
    perBranch.set(bName, be);
  }
  const jobRows = [...perJob.values()].sort((a, b) => b.apps - a.apps);
  const branchRows = [...perBranch.entries()].sort((a, b) => b[1].apps - a[1].apps);

  // --- Onboarding data (kept from before) ---
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("id, title, task_type, status, doc_path, note, required, due_date, applicant_id, applicants(first_name, last_name, email)")
    .eq("company_id", current.company_id)
    .order("position", { ascending: true });
  const byPerson = new Map<string, { name: string; tasks: OnbTask[] }>();
  for (const t of (tasks ?? []) as unknown as TaskRow[]) {
    const name = [t.applicants?.first_name, t.applicants?.last_name].filter(Boolean).join(" ") || t.applicants?.email || "New starter";
    const entry = byPerson.get(t.applicant_id) ?? { name, tasks: [] };
    entry.tasks.push(t);
    byPerson.set(t.applicant_id, entry);
  }
  const people = [...byPerson.values()];

  const card = "rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm";
  const stat = (label: string, value: string | number, sub?: string) => (
    <div className={card}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Recruitment performance and onboarding progress." />

      <Link
        href="/reports/compliance"
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/30"
      >
        <ShieldCheck className="h-4 w-4" /> Compliance reports (CQC / CIW)
      </Link>

      {/* Range filter + exports */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(RANGES).map(([key, r]) => (
            <Link
              key={key}
              href={`/reports?range=${key}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${range === key ? "bg-brand-600 text-white" : "bg-white/80 text-gray-700 hover:bg-white"}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <ExportCsvButton
            filename={`recruitment-by-job-${range}.csv`}
            rows={jobRows.map((j) => ({
              Job: j.title,
              Applications: j.apps,
              Hired: j.hired,
              "Conversion %": j.apps ? Math.round((j.hired / j.apps) * 100) : 0,
            }))}
          />
          <ExportPdfLink href={`/api/report/pdf?type=recruitment&range=${range}`} />
        </div>
      </div>

      {/* Headline stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stat("Applications", total)}
        {stat("In progress", active)}
        {stat("Hired", hired, `${conversion}% conversion`)}
        {stat("Avg time to hire", avgTth === null ? "—" : `${avgTth}d`, avgTth === null ? "no hires yet" : "applied → hired")}
        {stat("Not progressing", rejected)}
      </div>

      {/* Funnel */}
      <div className={`mt-4 ${card}`}>
        <p className="text-sm font-semibold text-gray-900">Recruitment funnel</p>
        <p className="text-xs text-gray-400">Applicants currently at each stage ({RANGES[range].label.toLowerCase()}).</p>
        <div className="mt-3 space-y-2">
          {FUNNEL.map((s) => {
            const n = stageCount(s);
            const pct = Math.round((n / funnelMax) * 100);
            return (
              <div key={s} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-gray-600">{STAGE_LABEL[s]}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-gray-100">
                  <div className="flex h-full items-center rounded-md bg-brand-500 px-2" style={{ width: `${Math.max(pct, n > 0 ? 8 : 0)}%` }}>
                    {n > 0 && <span className="text-[11px] font-semibold text-white">{n}</span>}
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-xs text-gray-500">{total > 0 ? Math.round((n / total) * 100) : 0}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-job + per-branch */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className={card}>
          <p className="text-sm font-semibold text-gray-900">By job</p>
          {jobRows.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No applications in this period.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 font-medium">Job</th>
                  <th className="py-1.5 text-right font-medium">Apps</th>
                  <th className="py-1.5 text-right font-medium">Hired</th>
                  <th className="py-1.5 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobRows.map((j, i) => (
                  <tr key={i}>
                    <td className="truncate py-1.5 pr-2 text-gray-800">{j.title}</td>
                    <td className="py-1.5 text-right text-gray-700">{j.apps}</td>
                    <td className="py-1.5 text-right text-gray-700">{j.hired}</td>
                    <td className="py-1.5 text-right text-gray-500">{j.apps ? Math.round((j.hired / j.apps) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={card}>
          <p className="text-sm font-semibold text-gray-900">By branch</p>
          {branchRows.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No applications in this period.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 font-medium">Branch</th>
                  <th className="py-1.5 text-right font-medium">Apps</th>
                  <th className="py-1.5 text-right font-medium">Hired</th>
                  <th className="py-1.5 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branchRows.map(([name, b], i) => (
                  <tr key={i}>
                    <td className="truncate py-1.5 pr-2 text-gray-800">{name}</td>
                    <td className="py-1.5 text-right text-gray-700">{b.apps}</td>
                    <td className="py-1.5 text-right text-gray-700">{b.hired}</td>
                    <td className="py-1.5 text-right text-gray-500">{b.apps ? Math.round((b.hired / b.apps) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Onboarding progress */}
      <div className="mt-4">
        <CollapsibleSection title="Onboarding progress" count={people.length} defaultOpen={false}>
          {people.length === 0 ? (
            <p className="px-1 py-2 text-sm text-gray-500">No applicants have workflow tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map((p, i) => {
                const done = p.tasks.filter((t) => t.status === "approved").length;
                return (
                  <CollapsibleSection key={i} title={`${p.name} — ${done}/${p.tasks.length} complete`} count={p.tasks.length}>
                    <ul className="space-y-2">
                      {p.tasks.map((t) => (
                        <OnboardingTaskReview key={t.id} task={t} />
                      ))}
                    </ul>
                  </CollapsibleSection>
                );
              })}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
