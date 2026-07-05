import { NextRequest, NextResponse } from "next/server";
import { runTalentPoolPurge } from "@/lib/comms/talent-pool-purge";
import { cronAuthorized } from "@/lib/security/prod";
import { logError } from "@/lib/errors/log";

// Daily Vercel Cron (see vercel.json). Warns talent-pool candidates ~14 days
// before their six month consent lapses, then purges the retained data once it
// has. Fail closed in production (authenticated by CRON_SECRET bearer).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTalentPoolPurge();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Talent pool purge failed";
    await logError({
      source: "api/cron/talent-pool",
      message,
      detail: e instanceof Error ? { stack: e.stack } : undefined,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
