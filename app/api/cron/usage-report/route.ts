import { NextRequest, NextResponse } from "next/server";
import { runUsageReport } from "@/lib/billing/report-usage";
import { logError } from "@/lib/errors/log";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runUsageReport();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Usage report failed";
    await logError({ source: "api/cron/usage-report", message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
