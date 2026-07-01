"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscription, swapSubscriptionBasePrice, basePriceFor, setSubscriptionTier } from "@/lib/billing/stripe";
import { runUsageReport } from "@/lib/billing/report-usage";

/** Founder: give or remove complimentary (free) access for a company. */
export async function founderCompToggle(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const comp = formData.get("comp") === "true";
  const db = createAdminClient();
  await db.from("companies").update({ billing_comped: comp }).eq("id", id);
  revalidatePath(`/founder/billing/${id}`);
  revalidatePath("/founder/billing");
}

/** Founder: cancel a company's subscription at the end of the current period. */
export async function founderCancelSubscription(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const db = createAdminClient();
  const { data: c } = await db.from("companies").select("stripe_subscription_id").eq("id", id).single();
  const subId = c?.stripe_subscription_id as string | null;
  if (subId) {
    try {
      await cancelSubscription(subId);
    } catch {
      /* surfaced via Stripe; best-effort */
    }
  }
  revalidatePath(`/founder/billing/${id}`);
  revalidatePath("/founder/billing");
}

/** Founder: clear a stale/invalid Stripe link so the company can re-subscribe. */
export async function founderResetBilling(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const db = createAdminClient();
  await db
    .from("companies")
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      billing_status: "none",
      billing_interval: null,
      current_period_end: null,
      setup_fee_paid: false,
      commitment_until: null,
    })
    .eq("id", id);
  revalidatePath(`/founder/billing/${id}`);
  revalidatePath("/founder/billing");
}

/**
 * Founder: set a company's tier (Core / Poppy). Updates agreed_tier + plan_tier +
 * poppy_enabled, and — if there's an active subscription — moves the Stripe
 * subscription onto the matching base price and Poppy meter. Use this to sell
 * Tier 2 at setup, or to comp/remove Poppy for an existing company.
 */
export async function founderSetTier(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  const tier = formData.get("tier") === "poppy" ? "poppy" : "core";
  if (!id) return;
  const db = createAdminClient();
  const { data: c } = await db
    .from("companies")
    .select("stripe_subscription_id, billing_status, commitment_until")
    .eq("id", id)
    .single();

  const subId = c?.stripe_subscription_id as string | null;
  if (subId && c?.billing_status === "active") {
    const committed = c?.commitment_until ? new Date(c.commitment_until as string) > new Date() : false;
    try {
      await setSubscriptionTier(subId, tier, committed);
    } catch {
      /* surfaced via Stripe; DB flags still updated so entitlement is correct */
    }
  }

  await db
    .from("companies")
    .update({ plan_tier: tier, agreed_tier: tier, poppy_enabled: tier === "poppy" })
    .eq("id", id);
  revalidatePath(`/founder/billing/${id}`);
  revalidatePath(`/founder/companies/${id}`);
  revalidatePath("/founder/billing");
}

/**
 * Founder: attach Poppy to every ACTIVE Diamond (usage-only) company that doesn't
 * have it yet. Diamond now includes Poppy — new Diamond signups get the meter at
 * checkout; this backfills existing ones. Adds the Poppy meter to the live
 * subscription and turns Poppy on. Idempotent — already-enabled companies skip.
 */
export async function founderEnablePoppyForDiamond(): Promise<{ changed: number; skipped: number; errors: number }> {
  await requirePlatformAdmin();
  const res = { changed: 0, skipped: 0, errors: 0 };
  const db = createAdminClient();
  const { data: companies } = await db
    .from("companies")
    .select("id, stripe_subscription_id, billing_status, poppy_enabled")
    .eq("agreed_plan", "diamond")
    .not("stripe_subscription_id", "is", null);

  for (const c of companies ?? []) {
    const subId = c.stripe_subscription_id as string | null;
    if (!subId || c.billing_status !== "active" || c.poppy_enabled === true) {
      res.skipped++;
      continue;
    }
    try {
      await setSubscriptionTier(subId, "poppy"); // no base to swap on Diamond — just adds the meter
      await db.from("companies").update({ plan_tier: "poppy", poppy_enabled: true }).eq("id", c.id);
      res.changed++;
    } catch {
      res.errors++;
    }
  }
  revalidatePath("/founder/billing");
  return res;
}

/** Founder: push all unreported usage to Stripe now. */
export async function founderRunUsageReport(): Promise<void> {
  await requirePlatformAdmin();
  await runUsageReport();
  revalidatePath("/founder/billing");
}

/**
 * Founder: migrate every live Core (Tier 1) subscription onto the CURRENT base
 * price (the new £49/£490 after you repoint STRIPE_PRICE_MONTHLY/ANNUAL). Swaps
 * the base item with no mid-cycle proration, so each company simply pays the new
 * price from their next invoice. Idempotent — companies already on the new price
 * are skipped. Run this AFTER creating the new Stripe prices and updating the env
 * vars. Tier 2 companies are left alone.
 */
export async function founderMigrateCorePrices(): Promise<{ changed: number; skipped: number; errors: number }> {
  await requirePlatformAdmin();
  const res = { changed: 0, skipped: 0, errors: 0 };
  const db = createAdminClient();
  const { data: companies } = await db
    .from("companies")
    .select("id, stripe_subscription_id, billing_interval, plan_tier")
    .eq("plan_tier", "core")
    .not("stripe_subscription_id", "is", null);

  for (const c of companies ?? []) {
    const subId = c.stripe_subscription_id as string | null;
    const interval = c.billing_interval === "year" ? "year" : "month";
    const newPrice = basePriceFor("core", interval, false);
    if (!subId || !newPrice) {
      res.skipped++;
      continue;
    }
    try {
      const { changed } = await swapSubscriptionBasePrice(subId, newPrice);
      if (changed) res.changed++;
      else res.skipped++;
    } catch {
      res.errors++;
    }
  }
  revalidatePath("/founder/billing");
  return res;
}
