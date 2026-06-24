import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors/log";

// Receives client/render errors from the global error boundary. No auth — errors
// can happen anywhere — but payload is sanitised and length-capped by logError.
export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024; // 16KB — render-error payloads are small
// Best-effort per-instance rate limit (soft cap; serverless instances are
// ephemeral, so this throttles single-source spam without a shared store).
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { n: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  h.n += 1;
  return h.n > RATE_MAX;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: true, throttled: true }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      source?: string;
      detail?: unknown;
    };
    const message = body.message || "Client error";

    // Ignore harmless "stale tab after deploy" noise: a client holding an old
    // build's server-action IDs that no longer exist on the new server. These
    // self-fix on reload and aren't real faults, so don't clutter the log.
    const isStaleDeploy =
      /server action .*was not found on the server/i.test(message) ||
      /failed to find server action/i.test(message);
    if (isStaleDeploy) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    await logError({
      source: body.source?.slice(0, 200) || "client",
      message,
      detail: body.detail,
    });
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
