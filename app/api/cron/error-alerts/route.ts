import { NextRequest, NextResponse } from "next/server";
import { runErrorAlerts } from "@/lib/errors/alert";
import { cronAuthorized } from "@/lib/security/prod";
import { logError } from "@/lib/errors/log";

// Every 15 min (see vercel.json). Emails the platform admin a digest of any new
// errors logged since the last alert. Fail closed in production (CRON_SECRET).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runErrorAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error alert run failed";
    // Best-effort: don't recursively alert on the alerter's own failure loudly.
    await logError({
      source: "api/cron/error-alerts",
      message,
      detail: e instanceof Error ? { stack: e.stack } : undefined,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
