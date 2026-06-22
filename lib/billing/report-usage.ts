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

  // Cache customer ids per company.
  const customerCache = new Map<string, string | null>();
  const getCustomer = async (companyId: string): Promise<string | null> => {
    if (customerCache.has(companyId)) return customerCache.get(companyId)!;
    const { data } = await db.from("companies").select("stripe_customer_id").eq("id", companyId).single();
    const id = (data?.stripe_customer_id as string) ?? null;
    customerCache.set(companyId, id);
    return id;
  };

  const nowIso = new Date().toISOString();
  for (const [key, g] of groups) {
    const [companyId, kind] = key.split(":");
    const customerId = await getCustomer(companyId);
    const eventName = METER[kind as "sms" | "ai"];
    if (!customerId || !eventName) {
      res.skipped += g.ids.length;
      continue;
    }
    try {
      await reportMeterEvent(eventName, customerId, g.total);
      await db.from("usage_events").update({ reported_at: nowIso }).in("id", g.ids);
      res.reported += g.ids.length;
    } catch {
      res.skipped += g.ids.length;
    }
  }

  return res;
}
