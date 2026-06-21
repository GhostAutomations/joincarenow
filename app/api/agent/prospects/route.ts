import { NextRequest, NextResponse } from "next/server";
import { checkAgentKey } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/agent/prospects?stage=contacted  → list prospects (context for agents)
export async function GET(req: NextRequest) {
  if (!checkAgentKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const stage = req.nextUrl.searchParams.get("stage");
  let q = db
    .from("prospect_companies")
    .select("id, name, stage, region, setting_type, website")
    .order("created_at", { ascending: false })
    .limit(200);
  if (stage) q = q.eq("stage", stage);
  const { data } = await q;
  return NextResponse.json({ prospects: data ?? [] });
}
