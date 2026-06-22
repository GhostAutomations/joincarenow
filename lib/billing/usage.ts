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
  quantity = 1
): Promise<void> {
  if (!companyId || quantity <= 0) return;
  try {
    const db = createAdminClient();
    await db.from("usage_events").insert({ company_id: companyId, kind, quantity });
  } catch {
    /* metering must never break the feature */
  }
}

/** Send a customer SMS and meter it against the company (1 unit on success). */
export async function sendCompanySms(
  companyId: string | null | undefined,
  opts: { to: string; body: string }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = await sendSms(opts);
  if (r.ok) await recordUsage(companyId, "sms");
  return r;
}
