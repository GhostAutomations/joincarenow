import { createAdminClient } from "@/lib/supabase/admin";
import { reportMeterEvent } from "@/lib/billing/stripe";

const METER = {
  sms: process.env.STRIPE_METER_SMS ?? "jcn_sms",
  ai: process.env.STRIPE_METER_AI ?? "jcn_ai",
};

export type UsageReportRun = { reported: number; skipped: number };

/**
 * Push unreported usage to Stripe Billing Meters, grouped by company + kind,
 * then mark those events reported. Stripe handles the included 100 SMS via a
 * tiered price (first 100 at £0); AI is billed per action. No-op without Stripe.
 */
export async function runUsageReport(): Promise<UsageReportRun> {
  const res: UsageReportRun = { reported: 0, skipped: 0 };
  if (!process.env.STRIPE_SECRET_KEY) return res;

  const db = createAdminClient();
  const { data: events } = await db
    .from("usage_events")
    .select("id, company_id, kind, quantity")
    .is("reported_at", null)
    .limit(2000);
  if (!events || events.length === 0) return res;

  // Group: company -> kind -> { total, ids }
  const groups = new Map<string, { ids: string[]; total: number }>();
  for (const e of events) {
    const key = `${e.company_id}:${e.kind}`;
    const g = groups.get(key) ?? { ids: [], total: 0 };
    g.ids.push(e.id as string);
    g.total += (e.quantity as number) ?? 1;
    groups.set(key, g);
  }

  const nowIso = new Date().toISOString();
  const month = nowIso.slice(0, 7); // 'YYYY-MM'

  // Cache billing info per company, including this month's SMS-bonus usage.
  type Co = { customerId: string | null; smsBonus: number; bonusUsed: number };
  const coCache = new Map<string, Co>();
  const getCo = async (companyId: string): Promise<Co> => {
    if (coCache.has(companyId)) return coCache.get(companyId)!;
    const { data } = await db
      .from("companies")
      .select("stripe_customer_id, sms_bonus, sms_bonus_used, sms_bonus_month")
      .eq("id", companyId)
      .single();
    const co: Co = {
      customerId: (data?.stripe_customer_id as string) ?? null,
      smsBonus: (data?.sms_bonus as number) ?? 0,
      // Reset the counter when the month rolls over.
      bonusUsed: data?.sms_bonus_month === month ? ((data?.sms_bonus_used as number) ?? 0) : 0,
    };
    coCache.set(companyId, co);
    return co;
  };

  for (const [key, g] of groups) {
    const [companyId, kind] = key.split(":");
    const co = await getCo(companyId);
    const eventName = METER[kind as "sms" | "ai"];
    if (!co.customerId || !eventName) {
      res.skipped += g.ids.length;
      continue;
    }

    // SMS bonus: withhold the first `sms_bonus` SMS this month from metering.
    let reportQty = g.total;
    let absorbed = 0;
    if (kind === "sms" && co.smsBonus > 0) {
      const remaining = Math.max(0, co.smsBonus - co.bonusUsed);
      absorbed = Math.min(remaining, g.total);
      reportQty = g.total - absorbed;
    }

    try {
      if (reportQty > 0) await reportMeterEvent(eventName, co.customerId, reportQty);
      await db.from("usage_events").update({ reported_at: nowIso }).in("id", g.ids);
      if (kind === "sms" && absorbed > 0) {
        co.bonusUsed += absorbed;
        await db.from("companies").update({ sms_bonus_used: co.bonusUsed, sms_bonus_month: month }).eq("id", companyId);
      }
      res.reported += g.ids.length;
    } catch {
      res.skipped += g.ids.length;
    }
  }

  return res;
}
