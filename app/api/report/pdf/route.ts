import { NextRequest, NextResponse } from "next/server";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";
import { buildReportPdf, type ReportTable } from "@/lib/reports/pdf";
import { getRecruitmentReport, getPlatformReport, getBillingReport, rangeKeyOf } from "@/lib/reports/data";
import { getStaffRegister, getSafeRecruitment, getTurnover, getEstablishment } from "@/lib/reports/compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pdf(bytes: Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
const money = (n: number) => "GBP " + n.toFixed(2);

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "recruitment";
  const range = rangeKeyOf(req.nextUrl.searchParams.get("range") ?? undefined);

  // Company compliance reports.
  if (["staff_register", "safe_recruitment", "turnover", "establishment"].includes(type)) {
    const { supabase, current } = await requireCompany();
    const cid = current.company_id;
    if (type === "staff_register") {
      const rows = await getStaffRegister(supabase, cid);
      const bytes = buildReportPdf({
        title: "Staff register", subtitle: `${rows.length} active staff`,
        tables: [{ columns: [{ header: "ID", width: 10 }, { header: "Name", width: 24 }, { header: "Role", width: 18 }, { header: "Branch", width: 14 }, { header: "Type", width: 14 }, { header: "Start", width: 11 }], rows: rows.map((r) => [r.ref, r.name, r.role, r.branch, r.type, r.start]) }],
      });
      return pdf(bytes, "staff-register.pdf");
    }
    if (type === "safe_recruitment") {
      const rows = await getSafeRecruitment(supabase, cid);
      const bytes = buildReportPdf({
        title: "Safe recruitment compliance", subtitle: "Right to Work, references and DBS (CQC Reg 19 / CIW safe recruitment)",
        stats: [{ label: "Staff with gaps", value: String(rows.filter((r) => r.gaps > 0).length) }],
        tables: [{ columns: [{ header: "Name", width: 22 }, { header: "Role", width: 16 }, { header: "Right to Work", width: 22 }, { header: "References", width: 14 }, { header: "DBS", width: 12 }], rows: rows.map((r) => [r.name, r.role, r.rtw, r.refs, r.dbs]) }],
      });
      return pdf(bytes, "safe-recruitment.pdf");
    }
    if (type === "turnover") {
      const r = await getTurnover(supabase, cid, range);
      const bytes = buildReportPdf({
        title: "Turnover & leavers", subtitle: `Period: ${r.rangeLabel}`,
        stats: [
          { label: "Headcount", value: String(r.metrics.headcount) },
          { label: "Joiners", value: String(r.metrics.joiners) },
          { label: "Leavers", value: String(r.metrics.leavers) },
          { label: "Turnover", value: `${r.metrics.turnoverPct}%` },
        ],
        tables: [{ title: "Leavers", columns: [{ header: "Name", width: 22 }, { header: "Role", width: 16 }, { header: "Branch", width: 14 }, { header: "Left", width: 11 }, { header: "Reason", width: 22 }], rows: r.leaverRows.map((l) => [l.name, l.role, l.branch, l.left, l.reason]) }],
      });
      return pdf(bytes, `turnover-${range}.pdf`);
    }
    // establishment
    const r = await getEstablishment(supabase, cid);
    const bytes = buildReportPdf({
      title: "Staffing establishment", subtitle: `${r.vacancies} open vacancies`,
      tables: [{
        columns: [{ header: "Branch", width: 22 }, { header: "Full time", width: 9, align: "right" }, { header: "Part time", width: 9, align: "right" }, { header: "Student", width: 8, align: "right" }, { header: "Not set", width: 8, align: "right" }, { header: "Total", width: 7, align: "right" }],
        rows: [...r.branchRows.map((b) => [b.branch, b.full_time, b.part_time, b.student_20, b.not_set, b.total]), ["ALL", r.totals.full_time, r.totals.part_time, r.totals.student_20, r.totals.not_set, r.totals.total]],
      }],
    });
    return pdf(bytes, "establishment.pdf");
  }

  if (type === "recruitment") {
    const { supabase, current } = await requireCompany({ allowSetup: true });
    const r = await getRecruitmentReport(supabase, current.company_id, range);
    const tables: ReportTable[] = [
      {
        title: "Recruitment funnel",
        columns: [{ header: "Stage", width: 16 }, { header: "Count", width: 8, align: "right" }, { header: "% of total", width: 10, align: "right" }],
        rows: r.funnel.map((f) => [f.label, f.count, `${f.pctOfTotal}%`]),
      },
      {
        title: "By job",
        columns: [{ header: "Job", width: 34 }, { header: "Apps", width: 6, align: "right" }, { header: "Hired", width: 6, align: "right" }, { header: "Conv", width: 6, align: "right" }],
        rows: r.jobRows.map((j) => [j.title, j.apps, j.hired, `${j.conv}%`]),
      },
      {
        title: "By branch",
        columns: [{ header: "Branch", width: 34 }, { header: "Apps", width: 6, align: "right" }, { header: "Hired", width: 6, align: "right" }, { header: "Conv", width: 6, align: "right" }],
        rows: r.branchRows.map((b) => [b.name, b.apps, b.hired, `${b.conv}%`]),
      },
    ];
    const bytes = buildReportPdf({
      title: "Recruitment report",
      subtitle: `Period: ${r.rangeLabel}`,
      stats: [
        { label: "Applications", value: String(r.stats.total) },
        { label: "In progress", value: String(r.stats.active) },
        { label: "Hired", value: `${r.stats.hired} (${r.stats.conversion}% conversion)` },
        { label: "Avg time to hire", value: r.stats.avgTth === null ? "—" : `${r.stats.avgTth} days` },
        { label: "Not progressing", value: String(r.stats.rejected) },
      ],
      tables,
    });
    return pdf(bytes, `recruitment-report-${range}.pdf`);
  }

  // Founder-only reports.
  await requirePlatformAdmin();
  const db = createAdminClient();

  if (type === "platform") {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const monthStart = londonToUtcIso(`${todayStr.slice(0, 7)}-01T00:00`);
    const r = await getPlatformReport(db, range, monthStart);
    const bytes = buildReportPdf({
      title: "Platform statistics",
      subtitle: `Period: ${r.rangeLabel}`,
      stats: [
        { label: "Companies", value: String(r.totals.companies) },
        { label: "Applications", value: String(r.totals.apps) },
        { label: "Hires", value: `${r.totals.hired} (${r.totals.conversion}% conversion)` },
        { label: "Live jobs", value: String(r.totals.live) },
        { label: "Messages this month", value: String(r.totals.msgs) },
      ],
      tables: [
        {
          title: "Recruitment funnel (platform)",
          columns: [{ header: "Stage", width: 16 }, { header: "Count", width: 8, align: "right" }, { header: "% of total", width: 10, align: "right" }],
          rows: r.funnel.map((f) => [f.label, f.count, `${f.pctOfTotal}%`]),
        },
        {
          title: "By company",
          columns: [
            { header: "Company", width: 26 }, { header: "Billing", width: 9 },
            { header: "Apps", width: 5, align: "right" }, { header: "Active", width: 6, align: "right" },
            { header: "Hires", width: 5, align: "right" }, { header: "Jobs", width: 5, align: "right" }, { header: "Msgs", width: 5, align: "right" },
          ],
          rows: r.companyRows.map((c) => [c.name, c.billing, c.apps, c.active, c.hired, c.live, c.msgs]),
        },
      ],
    });
    return pdf(bytes, `platform-statistics-${range}.pdf`);
  }

  if (type === "billing") {
    const r = await getBillingReport(db);
    const bytes = buildReportPdf({
      title: "Revenue report",
      stats: [
        { label: "MRR", value: money(r.metrics.mrr) },
        { label: "ARR", value: money(r.metrics.arr) },
        { label: "Paying customers", value: String(r.metrics.paying) },
        { label: "On commitment", value: String(r.metrics.onCommitment) },
        { label: "Past due", value: String(r.metrics.pastDue) },
        { label: "Complimentary", value: String(r.metrics.comped) },
        { label: "Plans", value: `${r.metrics.monthly} monthly · ${r.metrics.annual} annual · ${r.metrics.diamond} diamond` },
      ],
      tables: [
        {
          title: "By company",
          columns: [
            { header: "Company", width: 28 }, { header: "Status", width: 13 }, { header: "Plan", width: 10 },
            { header: "Branches", width: 8, align: "right" }, { header: "MRR", width: 9, align: "right" },
          ],
          rows: r.companyRows.map((c) => [c.name, c.status, c.plan, c.branches, c.mrr.toFixed(2)]),
        },
      ],
    });
    return pdf(bytes, "revenue-report.pdf");
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
