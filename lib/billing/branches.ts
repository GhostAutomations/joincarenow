import { createAdminClient } from "@/lib/supabase/admin";
import { syncBranchQuantity } from "@/lib/billing/stripe";

/**
 * Recompute a company's chargeable extra-branch count (everything beyond the 1
 * included branch), store it, and push the quantity to Stripe. Best-effort —
 * never throws, so branch admin actions can't be blocked by billing.
 */
export async function syncExtraBranches(companyId: string): Promise<void> {
  try {
    const db = createAdminClient();
    // Only real location branches are billable — the Office Team (kind='office')
    // is structural and free, so it never counts toward the extra-branch charge.
    const { count } = await db
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("kind", "branch");
    const extra = Math.max(0, (count ?? 0) - 1);

    const { data: company } = await db
      .from("companies")
      .select("stripe_subscription_id, agreed_plan")
      .eq("id", companyId)
      .single();

    await db.from("companies").update({ extra_branches: extra }).eq("id", companyId);
    // Diamond pays only for SMS + AI — extra branches are free, so never push a
    // branch quantity to their subscription.
    if (company?.agreed_plan === "diamond") return;
    await syncBranchQuantity((company?.stripe_subscription_id as string) ?? null, extra);
  } catch {
    /* best-effort */
  }
}
