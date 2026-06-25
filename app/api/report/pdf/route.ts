import { NextRequest, NextResponse } from "next/server";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";
import { buildReportPdf, type ReportTable } from "@/lib/reports/pdf";
import { getRecruitmentReport, getPlatformReport, getBillingReport, rangeKeyOf } from "@/lib/reports/data";

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
