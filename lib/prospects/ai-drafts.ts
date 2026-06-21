import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftProspectMessage } from "@/lib/ai/draft-prospect";
import { detectHighRisk } from "@/lib/prospects";
import { sendToProspectContact } from "@/lib/prospects/sequences";

export type AutoSendMode = "off" | "low_risk" | "all";

export async function getAutoSendMode(db: SupabaseClient): Promise<AutoSendMode> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "prospect_autosend").maybeSingle();
  const v = data?.value;
  return v === "all" || v === "low_risk" ? v : "off";
}

/** Generate an AI draft for one contact (does not save). */
async function generateDraft(
  db: SupabaseClient,
  companyId: string,
  contactId: string,
  channel: "email" | "sms"
): Promise<{ contact: Record<string, unknown>; companyName: string; subject: string | null; body: string; highRisk: boolean } | { error: string }> {
  const [{ data: company }, { data: contact }, { data: acts }] = await Promise.all([
    db.from("prospect_companies").select("name, stage, setting_type, region").eq("id", companyId).single(),
    db.from("prospect_contacts").select("id, name, email, phone, opted_out, unsub_token").eq("id", contactId).single(),
    db.from("prospect_activities").select("direction, channel, subject, body, created_at").eq("prospect_company_id", companyId).eq("type", "message").order("created_at", { ascending: true }).limit(12),
  ]);
  if (!company || !contact) return { error: "Prospect or contact not found" };
  if (contact.opted_out) return { error: "Contact has opted out" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (acts ?? []) as any[];
  const lastInbound = [...history].reverse().find((h) => h.direction === "inbound")?.body ?? null;

  try {
    const draft = await draftProspectMessage({
      channel,
      companyName: company.name as string,
      contactName: contact.name as string | null,
      stage: company.stage as string | null,
      setting: company.setting_type as string | null,
      region: company.region as string | null,
      history,
      lastInbound,
    });
    return {
      contact: contact as Record<string, unknown>,
      companyName: company.name as string,
      subject: draft.subject,
      body: draft.body,
      highRisk: detectHighRisk(`${draft.subject ?? ""} ${draft.body}`),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI drafting failed" };
  }
}

/** Manual "Draft with AI" — always parks in the approval queue. */
export async function buildAndInsertDraft(
  db: SupabaseClient,
  companyId: string,
  contactId: string,
  channel: "email" | "sms" = "email"
): Promise<{ ok?: boolean; error?: string }> {
  const g = await generateDraft(db, companyId, contactId, channel);
  if ("error" in g) return { error: g.error };
  await db.from("prospect_activities").insert({
    prospect_company_id: companyId,
    contact_id: contactId,
    type: "message",
    channel,
    direction: "outbound",
    subject: g.subject,
    body: g.body,
    status: "logged",
    needs_approval: true,
    high_risk: g.highRisk,
    meta: { source: "ai_agent" },
  });
  return { ok: true };
}

export type DraftRun = { drafted: number; sent: number; skipped: number };

/** Auto-respond to prospects with an unanswered inbound message. Depending on
 *  the auto-send mode, replies either send automatically or park for approval. */
export async function runProspectDrafts(): Promise<DraftRun> {
  const db = createAdminClient();
  const res: DraftRun = { drafted: 0, sent: 0, skipped: 0 };
  const CAP = 8;
  const mode = await getAutoSendMode(db);
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
    if (res.drafted + res.sent >= CAP) break;
    const cid = ib.prospect_company_id as string;
    if (seen.has(cid)) continue;
    seen.add(cid);

    const { data: pending } = await db.from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("needs_approval", true).limit(1);
    if (pending && pending.length) { res.skipped += 1; continue; }
    const { data: laterOut } = await db.from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("type", "message").eq("direction", "outbound").gt("created_at", ib.created_at as string).limit(1);
    if (laterOut && laterOut.length) { res.skipped += 1; continue; }

    const channel = ib.channel === "sms" ? "sms" : "email";
    const g = await generateDraft(db, cid, ib.contact_id as string, channel);
    if ("error" in g) { res.skipped += 1; continue; }

    const autoSend = mode === "all" || (mode === "low_risk" && !g.highRisk);
    if (autoSend) {
      const r = await sendToProspectContact(db, {
        companyId: cid,
        contact: g.contact,
        companyName: g.companyName,
        channel,
        subject: g.subject ?? "",
        body: g.body,
      });
      if (r.ok) res.sent += 1; else res.skipped += 1;
    } else {
      await db.from("prospect_activities").insert({
        prospect_company_id: cid, contact_id: ib.contact_id, type: "message", channel,
        direction: "outbound", subject: g.subject, body: g.body, status: "logged",
        needs_approval: true, high_risk: g.highRisk, meta: { source: "ai_agent" },
      });
      res.drafted += 1;
    }
  }

  // First contact: brand-new prospects with a reachable contact and no outbound
  // yet get an AI-written opener. Sending trips the auto-stage move to Contacted.
  if (res.drafted + res.sent < CAP) {
    const { data: newCos } = await db
      .from("prospect_companies")
      .select("id, prospect_contacts(id, email, phone, opted_out)")
      .eq("stage", "new")
      .order("created_at", { ascending: true })
      .limit(50);

    for (const co of newCos ?? []) {
      if (res.drafted + res.sent >= CAP) break;
      const cid = co.id as string;

      const { data: anyOut } = await db.from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("type", "message").eq("direction", "outbound").limit(1);
      if (anyOut && anyOut.length) continue;
      const { data: pendingNew } = await db.from("prospect_activities").select("id").eq("prospect_company_id", cid).eq("needs_approval", true).limit(1);
      if (pendingNew && pendingNew.length) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts = ((co as any).prospect_contacts ?? []) as any[];
      const contact = contacts.find((c) => !c.opted_out && c.email) ?? contacts.find((c) => !c.opted_out && c.phone);
      if (!contact) continue;
      const channel = contact.email ? "email" : "sms";

      const g = await generateDraft(db, cid, contact.id as string, channel);
      if ("error" in g) { res.skipped += 1; continue; }

      const autoSend = mode === "all" || (mode === "low_risk" && !g.highRisk);
      if (autoSend) {
        const r = await sendToProspectContact(db, {
          companyId: cid, contact: g.contact, companyName: g.companyName,
          channel, subject: g.subject ?? "", body: g.body,
        });
        if (r.ok) res.sent += 1; else res.skipped += 1;
      } else {
        await db.from("prospect_activities").insert({
          prospect_company_id: cid, contact_id: contact.id, type: "message", channel,
          direction: "outbound", subject: g.subject, body: g.body, status: "logged",
          needs_approval: true, high_risk: g.highRisk, meta: { source: "ai_agent", first_contact: true },
        });
        res.drafted += 1;
      }
    }
  }

  return res;
}
