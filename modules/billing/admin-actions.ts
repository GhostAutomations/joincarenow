"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscription, swapSubscriptionBasePrice, basePriceFor, setSubscriptionTier, BASE_URL } from "@/lib/billing/stripe";
import { runUsageReport } from "@/lib/billing/report-usage";
import { sendBrandedEmail } from "@/lib/comms/branded";

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
 * Founder: OFFER Poppy to a company. Nothing changes on their subscription — this
 * records a pending offer (companies.settings.poppy_offer) and emails the
 * company's admin(s). The admin accepts on their Billing page, which is what
 * actually applies the tier change and the new billing. Idempotent.
 */
export async function founderOfferPoppy(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const db = createAdminClient();
  const { data: c } = await db
    .from("companies")
    .select("name, settings, plan_tier, agreed_plan")
    .eq("id", id)
    .single();
  if (!c || c.plan_tier === "poppy") return; // already on Poppy — nothing to offer

  const settings = { ...(c.settings && typeof c.settings === "object" ? (c.settings as Record<string, unknown>) : {}) };
  settings.poppy_offer = { status: "pending", offered_at: new Date().toISOString() };
  await db.from("companies").update({ settings }).eq("id", id);

  // Notify + email the company admin(s) — branded Join Care Now platform email
  // (CTA only) plus an in-app notification linking to Billing.
  const { data: admins } = await db
    .from("company_users")
    .select("user_id, profiles ( email )")
    .eq("company_id", id)
    .eq("role", "admin");
  const adminRows = (admins ?? []) as unknown as { user_id: string | null; profiles: { email?: string } | null }[];

  const notifs = adminRows
    .filter((a) => a.user_id)
    .map((a) => ({
      company_id: id,
      user_id: a.user_id as string,
      type: "poppy_offer",
      title: "Add Poppy to your plan?",
      body: "Your provider has offered to add Poppy, your AI recruitment assistant. Review & confirm in Billing.",
      link: "/billing",
    }));
  if (notifs.length) await db.from("notifications").insert(notifs);

  const emails = [...new Set(adminRows.map((a) => a.profiles?.email).filter((e): e is string => !!e))];
  const isDiamond = c.agreed_plan === "diamond";
  const priceLine = isDiamond
    ? "It adds 40 applicant screens each month included, then 75p each — on your usage-only plan."
    : "It moves your plan to Tier 2 — £89/month (or £79/month on a 12-month term, or £790/year) — and includes 40 applicant screens each month, then 75p each.";
  for (const to of emails) {
    await sendBrandedEmail(db, null, {
      to,
      subject: "Add Poppy, your AI recruitment assistant, to your plan",
      text:
        `Poppy is the AI recruitment assistant that screens your applicants for you — reviewing each application against the role, asking the candidate a few follow-up questions, and giving you a clear hire recommendation.\n\n` +
        `${priceLine}\n\n` +
        `Nothing changes until you say yes. Open your Billing page to review and confirm — you'll authorise the updated billing there.`,
      cta: { label: "Review & add Poppy", url: `${BASE_URL}/billing` },
      footerNote: "You're receiving this because you're an admin on a Join Care Now account.",
    });
  }

  revalidatePath(`/founder/billing/${id}`);
  revalidatePath(`/founder/companies/${id}`);
}

/** Founder: withdraw a pending Poppy offer (before the admin accepts). */
export async function founderWithdrawPoppyOffer(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const db = createAdminClient();
  const { data: c } = await db.from("companies").select("settings").eq("id", id).single();
  const settings = { ...(c?.settings && typeof c.settings === "object" ? (c.settings as Record<string, unknown>) : {}) };
  delete settings.poppy_offer;
  await db.from("companies").update({ settings }).eq("id", id);
  await db.from("notifications").delete().eq("company_id", id).eq("type", "poppy_offer");
  revalidatePath(`/founder/billing/${id}`);
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
