import { NextRequest, NextResponse } from "next/server";
import { checkAgentKey } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/agent/followups → prospects in active stages for the agent to draft
// today's follow-ups for. Pollable by a scheduled task.
export async function GET(req: NextRequest) {
  if (!checkAgentKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data } = await db
    .from("prospect_companies")
    .select("id, name, stage, region, setting_type")
    .in("stage", ["contacted", "engaged", "demo", "proposal"])
    .order("updated_at", { ascending: true })
    .limit(50);
  return NextResponse.json({ followups: data ?? [] });
}
