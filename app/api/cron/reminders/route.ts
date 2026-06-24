import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/comms/reminders";
import { logError } from "@/lib/errors/log";
import { cronAuthorized } from "@/lib/security/prod";

// Hourly Vercel Cron (see vercel.json). Sends due reminders. Long-ish job, so
// give it headroom. Always dynamic — never cached.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel sends `Authorization: Bearer <CRON_SECRET>`. Fail closed in prod.
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reminder run failed";
    await logError({ source: "api/cron/reminders", message, detail: e instanceof Error ? { stack: e.stack } : undefined });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
