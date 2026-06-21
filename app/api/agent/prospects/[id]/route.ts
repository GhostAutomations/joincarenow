import { NextRequest, NextResponse } from "next/server";
import { checkAgentKey } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/agent/prospects/[id]  → full context: company + contacts + recent timeline
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAgentKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const db = createAdminClient();

  const [{ data: company }, { data: contacts }, { data: activity }] = await Promise.all([
    db.from("prospect_companies").select("id, name, stage, region, setting_type, size_band, website, source, notes").eq("id", id).single(),
    db.from("prospect_contacts").select("id, name, role, email, phone, opted_out").eq("prospect_company_id", id),
    db.from("prospect_activities").select("type, channel, direction, subject, body, status, created_at").eq("prospect_company_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ company, contacts: contacts ?? [], recent_activity: activity ?? [] });
}
