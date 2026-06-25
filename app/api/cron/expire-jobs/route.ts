import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/security/prod";
import { logError } from "@/lib/errors/log";

// Daily Vercel Cron (see vercel.json). Closes jobs that have reached their
// closing date, and jobs with no closing date older than 30 days — so expired
// roles drop out of Google for Jobs and the public site (the public page 404s
// once a job is closed). Fail closed in production.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const cutoffIso = new Date(Date.now() - 30 * 86400e3).toISOString();

    // 1) Past an explicit closing date.
    const { data: dated } = await admin
      .from("jobs")
      .update({ status: "closed" })
      .eq("status", "published")
      .lt("closing_date", today)
      .select("id");

    // 2) No closing date, posted more than 30 days ago.
    const { data: undated } = await admin
      .from("jobs")
      .update({ status: "closed" })
      .eq("status", "published")
      .is("closing_date", null)
      .lt("created_at", cutoffIso)
      .select("id");

    const closed = (dated?.length ?? 0) + (undated?.length ?? 0);
    return NextResponse.json({ ok: true, closed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "expire-jobs failed";
    await logError({
      source: "api/cron/expire-jobs",
      message,
      detail: e instanceof Error ? { stack: e.stack } : undefined,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
