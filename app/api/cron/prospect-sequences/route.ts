import { NextRequest, NextResponse } from "next/server";
import { runProspectSequences } from "@/lib/prospects/sequences";
import { logError } from "@/lib/errors/log";
import { cronAuthorized } from "@/lib/security/prod";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runProspectSequences();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sequence run failed";
    await logError({ source: "api/cron/prospect-sequences", message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
