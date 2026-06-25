import Link from "next/link";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { RANGES, rangeKeyOf } from "@/lib/reports/data";
import { getStaffRegister, getSafeRecruitment, getTurnover, getEstablishment } from "@/lib/reports/compliance";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { ExportPdfLink } from "@/components/dashboard/export-pdf-link";

export default async function ComplianceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase, current } = await requireCompany();
  const range = rangeKeyOf((await searchParams).range);
  const cid = current.company_id;

  const [register, safe, turnover, est] = await Promise.all([
    getStaffRegister(supabase, cid),
    getSafeRecruitment(supabase, cid),
    getTurnover(supabase, cid, range),
    getEstablishment(supabase, cid),
  ]);

  const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  const th = "px-2 py-1.5 text-left text-xs uppercase tracking-wide text-gray-400 font-medium";
  const td = "px-2 py-1.5 text-gray-700";

  return (
    <div>
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Reports
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-white" />
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Compliance reports</h1>
      </div>
      <p className="mt-1 text-sm text-white/80">
        Staffing evidence for CQC / CIW and the RI&apos;s quality reports (Reg 73 / Reg 80). Leavers are excluded from active reports.
      </p>

      {/* Staff register */}
      <div className={`mt-5 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Staff register</p>
            <p className="text-xs text-gray-400">{register.length} active staff</p>
          </div>
          <div className="flex gap-2">
            <ExportCsvButton filename="staff-register.csv" rows={register.map((r) => ({ "Employee ID": r.ref, Name: r.name, Role: r.role, Branch: r.branch, "Employment type": r.type, "Start date": r.start }))} />
            <ExportPdfLink href="/api/report/pdf?type=staff_register" />
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>ID</th><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Branch</th><th className={th}>Type</th><th className={th}>Start</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {register.map((r, i) => (
                <tr key={i}><td className={`${td} font-mono text-xs text-gray-500`}>{r.ref}</td><td className={`${td} font-medium text-gray-900`}>{r.name}</td><td className={td}>{r.role}</td><td className={td}>{r.branch}</td><td className={td}>{r.type}</td><td className={td}>{r.start}</td></tr>
              ))}
              {register.length === 0 && <tr><td className={td} colSpan={6}>No active staff.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe recruitment compliance */}
      <div className={`mt-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Safe recruitment compliance</p>
            <p className="text-xs text-gray-400">Right to Work, references and DBS per staff member (CQC Reg 19 / CIW safe recruitment).</p>
          </div>
          <div className="flex gap-2">
            <ExportCsvButton filename="safe-recruitment.csv" rows={safe.map((r) => ({ Name: r.name, Role: r.role, "Right to Work": r.rtw, References: r.refs, DBS: r.dbs, Gaps: r.gaps }))} />
            <ExportPdfLink href="/api/report/pdf?type=safe_recruitment" />
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Right to Work</th><th className={th}>References</th><th className={th}>DBS</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {safe.map((r, i) => (
                <tr key={i} className={r.gaps > 0 ? "bg-amber-50/50" : ""}>
                  <td className={`${td} font-medium text-gray-900`}>{r.name}</td><td className={td}>{r.role}</td>
                  <td className={td}>{r.rtw}</td><td className={td}>{r.refs}</td><td className={td}>{r.dbs}</td>
                  <td className={td}>{r.gaps > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{r.gaps} gap{r.gaps === 1 ? "" : "s"}</span>}</td>
                </tr>
              ))}
              {safe.length === 0 && <tr><td className={td} colSpan={6}>No active staff.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Turnover & leavers */}
      <div className={`mt-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Turnover &amp; leavers</p>
            <div className="mt-1 flex gap-1.5">
              {Object.entries(RANGES).map(([key, r]) => (
                <Link key={key} href={`/reports/compliance?range=${key}`} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${range === key ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{r.label}</Link>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <ExportCsvButton filename={`leavers-${range}.csv`} rows={turnover.leaverRows.map((r) => ({ Name: r.name, Role: r.role, Branch: r.branch, "Left date": r.left, Reason: r.reason }))} />
            <ExportPdfLink href={`/api/report/pdf?type=turnover&range=${range}`} />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Headcount", turnover.metrics.headcount], ["Joiners", turnover.metrics.joiners], ["Leavers", turnover.metrics.leavers], ["Turnover", `${turnover.metrics.turnoverPct}%`]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{l}</p><p className="mt-0.5 text-2xl font-bold text-gray-900">{v}</p></div>
          ))}
        </div>
        {turnover.leaverRows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Branch</th><th className={th}>Left</th><th className={th}>Reason</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {turnover.leaverRows.map((r, i) => (
                  <tr key={i}><td className={`${td} font-medium text-gray-900`}>{r.name}</td><td className={td}>{r.role}</td><td className={td}>{r.branch}</td><td className={td}>{r.left}</td><td className={td}>{r.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staffing establishment */}
      <div className={`mt-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Staffing establishment</p>
            <p className="text-xs text-gray-400">Headcount by branch and employment type · {est.vacancies} open vacanc{est.vacancies === 1 ? "y" : "ies"}.</p>
          </div>
          <div className="flex gap-2">
            <ExportCsvButton filename="establishment.csv" rows={est.branchRows.map((r) => ({ Branch: r.branch, "Full time": r.full_time, "Part time": r.part_time, "Student (20h)": r.student_20, "Not set": r.not_set, Total: r.total }))} />
            <ExportPdfLink href="/api/report/pdf?type=establishment" />
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Branch</th><th className={`${th} text-right`}>Full time</th><th className={`${th} text-right`}>Part time</th><th className={`${th} text-right`}>Student 20h</th><th className={`${th} text-right`}>Not set</th><th className={`${th} text-right`}>Total</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {est.branchRows.map((r, i) => (
                <tr key={i}><td className={`${td} font-medium text-gray-900`}>{r.branch}</td><td className={`${td} text-right`}>{r.full_time}</td><td className={`${td} text-right`}>{r.part_time}</td><td className={`${td} text-right`}>{r.student_20}</td><td className={`${td} text-right`}>{r.not_set}</td><td className={`${td} text-right font-semibold`}>{r.total}</td></tr>
              ))}
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                <td className={td}>All branches</td><td className={`${td} text-right`}>{est.totals.full_time}</td><td className={`${td} text-right`}>{est.totals.part_time}</td><td className={`${td} text-right`}>{est.totals.student_20}</td><td className={`${td} text-right`}>{est.totals.not_set}</td><td className={`${td} text-right`}>{est.totals.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
