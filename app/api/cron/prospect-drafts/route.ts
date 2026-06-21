import { NextRequest, NextResponse } from "next/server";
import { runProspectDrafts } from "@/lib/prospects/ai-drafts";
import { logError } from "@/lib/errors/log";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runProspectDrafts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Draft run failed";
    await logError({ source: "api/cron/prospect-drafts", message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
