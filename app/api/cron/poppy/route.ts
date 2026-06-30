import { NextRequest, NextResponse } from "next/server";
import { runPoppy } from "@/lib/poppy/process";
import { logError } from "@/lib/errors/log";
import { cronAuthorized } from "@/lib/security/prod";

// Generating reports calls Claude (PDF + text), so give it headroom.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel sends `Authorization: Bearer <CRON_SECRET>`. Fail closed in prod.
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPoppy();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poppy run failed";
    await logError({ source: "api/cron/poppy", message, detail: e instanceof Error ? { stack: e.stack } : undefined });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
