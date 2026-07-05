import { NextRequest, NextResponse } from "next/server";
import { runRetention } from "@/lib/privacy/retention";
import { cronAuthorized } from "@/lib/security/prod";
import { logError } from "@/lib/errors/log";

// Daily Vercel Cron (see vercel.json). Erases applicant/employee data whose
// company-configured retention period has lapsed. OFF for every company until
// they opt in. Fail closed in production (CRON_SECRET bearer).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRetention();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Retention run failed";
    await logError({
      source: "api/cron/retention",
      message,
      detail: e instanceof Error ? { stack: e.stack } : undefined,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
