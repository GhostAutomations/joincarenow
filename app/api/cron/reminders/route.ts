import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/comms/reminders";

// Hourly Vercel Cron (see vercel.json). Sends due reminders. Long-ish job, so
// give it headroom. Always dynamic — never cached.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the
  // CRON_SECRET env var is set. Reject anything else.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reminder run failed" },
      { status: 500 }
    );
  }
}
