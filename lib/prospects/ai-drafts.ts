import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftProspectMessage } from "@/lib/ai/draft-prospect";
import { detectHighRisk } from "@/lib/prospects";

/** Draft a message with AI for one prospect contact and drop it in the approval
 *  queue. Used by the manual button and the auto-draft cron. */
export async function buildAndInsertDraft(
  db: SupabaseClient,
  companyId: string,
  contactId: string,
  channel: "email" | "sms" = "email"
): Promise<{ ok?: boolean; error?: string }> {
  const [{ data: company }, { data: contact }, { data: acts }] = await Promise.all([
    db.from("prospect_companies").select("name, stage, setting_type, region").eq("id", companyId).single(),
    db.from("prospect_contacts").select("name, opted_out").eq("id", contactId).single(),
    db.from("prospect_activities").select("direction, channel, subject, body, created_at").eq("prospect_company_id", companyId).eq("type", "message").order("created_at", { ascending: true }).limit(12),
  ]);
  if (!company || !contact) return { error: "Prospect or contact not found" };
  if (contact.opted_out) return { error: "Contact has opted out" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (acts ?? []) as any[];
  const lastInbound = [...history].reverse().find((h) => h.direction === "inbound")?.body ?? null;

  let draft: { subject: string | null; body: string };
  try {
    draft = await draftProspectMessage({
      channel,
      companyName: company.name as string,
      contactName: contact.name as string | null,
      stage: company.stage as string | null,
      setting: company.setting_type as string | null,
      region: company.region as string | null,
      history,
      lastInbound,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI drafting failed" };
  }

  await db.from("prospect_activities").insert({
    prospect_company_id: companyId,
    contact_id: contactId,
    type: "message",
    channel,
    direction: "outbound",
    subject: draft.subject,
    body: draft.body,
    status: "logged",
    needs_approval: true,
    high_risk: detectHighRisk(`${draft.subject ?? ""} ${draft.body}`),
    meta: { source: "ai_agent" },
  });
  return { ok: true };
}

export type DraftRun = { drafted: number; skipped: number };

/** Auto-draft replies to prospects who have an unanswered inbound message.
 *  Each draft lands in the approval queue — never auto-sent. Capped per run. */
export async function runProspectDrafts(): Promise<DraftRun> {
  const db = createAdminClient();
  const res: DraftRun = { drafted: 0, skipped: 0 };
  const CAP = 8;
  const since = new Date(Date.now() - 14 * 86400e3).toISOString();

  const { data: inbounds } = await db
    .from("prospect_activities")
    .select("prospect_company_id, contact_id, created_at, channel")
    .eq("type", "message")
    .eq("direction", "inbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  const seen = new Set<string>();
  for (const ib of inbounds ?? []) {
    if (res.drafted >= CAP) break;
    const cid = ib.prospect_company_id as string;
    if (seen.has(cid)) continue;
    seen.add(cid);

    // Skip if a draft is already waiting for this prospect.
    const { data: pending } = await db
      .from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("needs_approval", true).limit(1);
    if (pending && pending.length) { res.skipped += 1; continue; }

    // Skip if we've already replied since this inbound.
    const { data: laterOut } = await db
      .from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("type", "message").eq("direction", "outbound").gt("created_at", ib.created_at as string).limit(1);
    if (laterOut && laterOut.length) { res.skipped += 1; continue; }

    const r = await buildAndInsertDraft(db, cid, ib.contact_id as string, ib.channel === "sms" ? "sms" : "email");
    if (r.ok) res.drafted += 1; else res.skipped += 1;
  }

  return res;
}
