import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGE_LABEL, type Stage } from "@/lib/prospects";

/** Events that automatically advance a prospect's pipeline stage. */
export type StageEvent = "sent" | "reply" | "demo" | "optout";

/**
 * Auto-advance rules. A prospect only moves when its current stage is in
 * `from` — so we never drag a deal backwards or override a later stage.
 *   sent   → Contacted   (first outbound email/SMS leaves "Contact ready")
 *   reply  → Engaged     (they replied)
 *   demo   → Demo booked
 *   optout → Lost        (opted out of email/SMS)
 */
const RULES: Record<StageEvent, { to: Stage; from: Stage[] }> = {
  sent: { to: "contacted", from: ["new"] },
  reply: { to: "engaged", from: ["new", "contacted"] },
  demo: { to: "demo", from: ["new", "contacted", "engaged", "proposal"] },
  optout: { to: "lost", from: ["new", "contacted", "engaged", "demo", "proposal"] },
};

/**
 * Move a prospect company to the stage implied by `event`, but only if its
 * current stage allows it. Logs an automatic stage_change to the timeline.
 * Safe to call from webhooks, crons and server actions (pass any client).
 */
export async function autoStage(
  db: SupabaseClient,
  companyId: string,
  event: StageEvent
): Promise<void> {
  const rule = RULES[event];
  if (!rule) return;

  const { data: company } = await db
    .from("prospect_companies")
    .select("stage")
    .eq("id", companyId)
    .single();
  if (!company) return;

  const current = company.stage as Stage;
  if (current === rule.to) return;
  if (!rule.from.includes(current)) return;

  const nowIso = new Date().toISOString();
  await db
    .from("prospect_companies")
    .update({ stage: rule.to, stage_changed_at: nowIso, updated_at: nowIso })
    .eq("id", companyId);
  await db.from("prospect_activities").insert({
    prospect_company_id: companyId,
    type: "stage_change",
    body: `${STAGE_LABEL[current]} → ${STAGE_LABEL[rule.to]} (auto)`,
    meta: { from: current, to: rule.to, auto: true, event },
  });
}
