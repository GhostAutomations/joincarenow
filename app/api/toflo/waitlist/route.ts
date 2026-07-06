import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/errors/log";

// Public waitlist capture for the Toflo coming-soon page. No session (it's a
// public marketing page). Idempotent: a repeat email is treated as success.
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const name = (body.name ?? "").trim().slice(0, 120) || null;
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("waitlist").insert({ email, name, source: "toflo" });
    // 23505 = already on the list; treat as success so the UX is friendly.
    if (error && error.code !== "23505") {
      await logError({ source: "api/toflo/waitlist", message: error.message, code: error.code });
      return NextResponse.json({ ok: false, error: "Could not join right now. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "waitlist failed";
    await logError({ source: "api/toflo/waitlist", message });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
