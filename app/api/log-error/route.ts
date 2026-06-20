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
    await logError({
      source: body.source?.slice(0, 200) || "client",
      message: body.message || "Client error",
      detail: body.detail,
    });
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
