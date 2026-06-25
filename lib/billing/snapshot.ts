import { createAdminClient } from "@/lib/supabase/admin";

export type Snapshot = {
  snapshot_date: string;
  mrr: number;
  paying: number;
  monthly: number;
  annual: number;
  committed: number;
  comped: number;
  past_due: number;
  total: number;
};

/** Compute today's billing metrics and upsert the daily snapshot. Idempotent
 *  per day (keyed by date), so it's safe to run from a cron or on page view. */
export async function recordBillingSnapshot(): Promise<void> {
  const db = createAdminClient();
  const { data } = await db
    .from("companies")
    .select("billing_status, billing_interval, commitment_until, extra_branches, billing_comped, agreed_plan");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPaying = (r: any) => (r.billing_status === "active" || r.billing_status === "trialing") && !r.billing_comped;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const committed = (r: any) => !!r.commitment_until && new Date(r.commitment_until) > now;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDiamond = (r: any) => r.agreed_plan === "diamond"; // free subscription — £0 recurring

  // Diamond contributes £0 recurring (usage-only); others pay base + branches.
  const mrr = rows.reduce(
    (s, r) => (isPaying(r) && !isDiamond(r) ? s + (r.billing_interval === "year" ? 550 / 12 : 55) + (r.extra_branches ?? 0) * 7.5 : s),
    0
  );

  const snapshot = {
    snapshot_date: new Date().toISOString().slice(0, 10),
    mrr: Math.round(mrr * 100) / 100,
    paying: rows.filter(isPaying).length,
    monthly: rows.filter((r) => isPaying(r) && !isDiamond(r) && r.billing_interval !== "year" && !committed(r)).length,
    annual: rows.filter((r) => isPaying(r) && r.billing_interval === "year").length,
    committed: rows.filter((r) => isPaying(r) && committed(r)).length,
    comped: rows.filter((r) => r.billing_comped === true).length,
    past_due: rows.filter((r) => r.billing_status === "past_due").length,
    total: rows.length,
  };

  await db.from("billing_snapshots").upsert(snapshot, { onConflict: "snapshot_date" });
}
