import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/comms/send";

/**
 * Record a billable usage event for a company. Best-effort: never throws, so
 * metering can't block the user action. Uses the service-role client (the
 * usage_events table has no insert policy for normal users).
 */
export async function recordUsage(
  companyId: string | null | undefined,
  kind: "sms" | "ai",
  quantity = 1,
  meta?: { label?: string | null; actorId?: string | null }
): Promise<void> {
  if (!companyId || quantity <= 0) return;
  try {
    const db = createAdminClient();
    await db.from("usage_events").insert({
      company_id: companyId,
      kind,
      quantity,
      label: meta?.label ?? null,
      actor_id: meta?.actorId ?? null,
    });
  } catch {
    /* metering must never break the feature */
  }
}

/**
 * Send a customer SMS and (by default) meter it against the company. Pass
 * `meta.meter = false` for Ruby's own SMS — Ruby is billed per applicant, so
 * its nudges must NOT count towards the company's SMS usage. `meta.label` is the
 * GDPR-safe reason (e.g. "Interview", "Reminder") stored for the usage drill-down.
 */
export async function sendCompanySms(
  companyId: string | null | undefined,
  opts: { to: string; body: string },
  meta?: { label?: string; actorId?: string | null; meter?: boolean }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await sendSms(opts);
  if (r.ok && meta?.meter !== false) {
    await recordUsage(companyId, "sms", 1, { label: meta?.label ?? "Message", actorId: meta?.actorId ?? null });
  }
  return r;
}
