import { NextRequest, NextResponse } from "next/server";
import { recordBillingSnapshot } from "@/lib/billing/snapshot";
import { logError } from "@/lib/errors/log";
import { cronAuthorized } from "@/lib/security/prod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await recordBillingSnapshot();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Billing snapshot failed";
    await logError({ source: "api/cron/billing-snapshot", message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
