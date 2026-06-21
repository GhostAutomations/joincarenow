import { NextRequest, NextResponse } from "next/server";
import { checkAgentKey } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/agent/replies?days=7 → inbound prospect replies (email + SMS) for the
// agents to read and action. Pollable by a scheduled task.
export async function GET(req: NextRequest) {
  if (!checkAgentKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const days = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10) || 7));
  const since = new Date(Date.now() - days * 86400e3).toISOString();

  const { data } = await db
    .from("prospect_activities")
    .select("id, prospect_company_id, contact_id, channel, body, created_at, prospect_companies(name), prospect_contacts(name, email, phone)")
    .eq("type", "message")
    .eq("direction", "inbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replies = (data ?? []).map((r: any) => ({
    id: r.id,
    prospect_company_id: r.prospect_company_id,
    company: r.prospect_companies?.name ?? null,
    contact: r.prospect_contacts?.name || r.prospect_contacts?.email || r.prospect_contacts?.phone || null,
    contact_id: r.contact_id,
    channel: r.channel,
    body: r.body,
    received_at: r.created_at,
  }));

  return NextResponse.json({ replies });
}
