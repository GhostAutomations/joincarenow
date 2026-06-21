import { NextRequest, NextResponse } from "next/server";
import { checkAgentKey } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectHighRisk } from "@/lib/prospects";

export const dynamic = "force-dynamic";

// POST /api/agent/prospects/[id]/draft  body: { contactId, channel?, subject?, body }
// Creates a draft that lands in the founder's approval queue. Never sends.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAgentKey(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as {
    contactId?: string; channel?: string; subject?: string; body?: string;
  };
  if (!b.contactId || !b.body) return NextResponse.json({ error: "contactId and body are required" }, { status: 400 });

  const channel = b.channel === "sms" ? "sms" : "email";
  const highRisk = detectHighRisk(`${b.subject ?? ""} ${b.body}`);

  const db = createAdminClient();
  const { data, error } = await db
    .from("prospect_activities")
    .insert({
      prospect_company_id: id,
      contact_id: b.contactId,
      type: "message",
      channel,
      direction: "outbound",
      subject: b.subject ?? null,
      body: b.body,
      status: "logged",
      needs_approval: true,
      high_risk: highRisk,
      meta: { source: "agent" },
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not create draft" }, { status: 500 });

  return NextResponse.json({ ok: true, draftId: data.id, needs_approval: true, high_risk: highRisk });
}
