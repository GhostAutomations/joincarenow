import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errors/log";

// Receives client/render errors from the global error boundary. No auth — errors
// can happen anywhere — but payload is sanitised and length-capped by logError.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
