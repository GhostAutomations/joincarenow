"use server";

import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ensureCustomer, createCheckoutSession, createPortalSession, setSubscriptionTier, BASE_URL } from "@/lib/billing/stripe";
import { parseConcession } from "@/lib/billing/concession";

type AgreedPlan = "monthly" | "commit" | "annual" | "diamond";
function planToCheckout(plan: AgreedPlan | null): { interval: "month" | "year"; commit: boolean; meteredOnly: boolean } {
  if (plan === "annual") return { interval: "year", commit: false, meteredOnly: false };
  if (plan === "commit") return { interval: "month", commit: true, meteredOnly: false };
  if (plan === "diamond") return { interval: "month", commit: false, meteredOnly: true };
  return { interval: "month", commit: false, meteredOnly: false }; // monthly (default)
}

/** New customer pays to activate: starts Checkout for the plan they were sold,
 *  with any agreed concession applied (free months, custom price, SMS bonus). */
export async function startActivationCheckout(): Promise<void> {
  const { current, profile } = await requireCompany({ allowSetup: true });
  if (current.role !== "admin") return;

  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("name, stripe_customer_id, agreed_plan, agreed_offer, agreed_tier")
    .eq("id", current.company_id)
    .single();

  const customerId = await ensureCustomer({
    existingId: (company?.stripe_customer_id as string) ?? null,
    companyId: current.company_id,
    name: (company?.name as string) ?? "Care company",
    email: profile?.email ?? null,
  });

  const concession = parseConcession(company?.agreed_offer as string | null);
  const update: Record<string, unknown> = {};
  if (customerId !== company?.stripe_customer_id) update.stripe_customer_id = customerId;
  if (concession?.extraSms) update.sms_bonus = concession.extraSms;
  if (Object.keys(update).length) await db.from("companies").update(update).eq("id", current.company_id);

  const { interval, commit, meteredOnly } = planToCheckout((company?.agreed_plan as AgreedPlan) ?? null);
  const tier = company?.agreed_tier === "poppy" ? "poppy" : "core";
  const url = await createCheckoutSession({
    customerId,
    companyId: current.company_id,
    tier,
    interval,
    commit,
    meteredOnly,
    concession: concession
      ? { freeMonths: concession.freeMonths, customMonthlyPence: concession.customMonthlyPence }
      : null,
    successUrl: `${BASE_URL}/activate?status=success`,
    cancelUrl: `${BASE_URL}/activate?status=cancelled`,
  });
  redirect(url);
}

/** Company admin starts a subscription checkout (monthly or annual). */
export async function startCheckout(formData: FormData): Promise<void> {
  const { current, profile } = await requireCompany({ allowSetup: true });
  if (current.role !== "admin") return;
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const commit = formData.get("commit") === "true";
  const tier = formData.get("tier") === "poppy" ? "poppy" : "core";

  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("name, stripe_customer_id")
    .eq("id", current.company_id)
    .single();

  const customerId = await ensureCustomer({
    existingId: (company?.stripe_customer_id as string) ?? null,
    companyId: current.company_id,
    name: (company?.name as string) ?? "Care company",
    email: profile?.email ?? null,
  });
  if (customerId !== company?.stripe_customer_id) {
    await db.from("companies").update({ stripe_customer_id: customerId }).eq("id", current.company_id);
  }

  const url = await createCheckoutSession({ customerId, companyId: current.company_id, tier, interval, commit });
  redirect(url);
}

/** Company admin adds Poppy to an ACTIVE subscription (Core → Tier 2). Swaps the
 *  base price to Tier 2 and attaches the Poppy meter; turns Poppy on immediately.
 *  The webhook also confirms the tier. */
export async function upgradeToPoppy(): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change the plan." };
  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("stripe_subscription_id, billing_status, commitment_until, plan_tier")
    .eq("id", current.company_id)
    .single();
  if (company?.plan_tier === "poppy") return { ok: true };
  const subId = company?.stripe_subscription_id as string | null;
  if (!subId || company?.billing_status !== "active") {
    return { error: "Add Poppy from an active subscription, or pick Tier 2 at checkout." };
  }
  const committed = company?.commitment_until ? new Date(company.commitment_until as string) > new Date() : false;
  try {
    await setSubscriptionTier(subId, "poppy", committed);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't update the subscription." };
  }
  await db
    .from("companies")
    .update({ plan_tier: "poppy", agreed_tier: "poppy", poppy_enabled: true })
    .eq("id", current.company_id);
  revalidatePath("/billing");
  revalidatePath("/settings");
  return { ok: true };
}

/** Company admin ACCEPTS a founder's Poppy offer — this is what authorises the
 *  new billing and applies it (moves Core to Tier 2 / adds the meter on Diamond,
 *  turns Poppy on). Clears the pending offer. */
export async function acceptPoppyOffer(): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can accept this." };
  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("settings, stripe_subscription_id, billing_status, commitment_until, plan_tier")
    .eq("id", current.company_id)
    .single();

  const offer = (company?.settings as { poppy_offer?: { status?: string } } | null)?.poppy_offer;
  if (!offer || offer.status !== "pending") return { error: "There's no Poppy offer to accept." };

  const subId = company?.stripe_subscription_id as string | null;
  if (subId && company?.billing_status === "active") {
    const committed = company?.commitment_until ? new Date(company.commitment_until as string) > new Date() : false;
    try {
      await setSubscriptionTier(subId, "poppy", committed);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't update the subscription." };
    }
  }

  const settings = { ...(company?.settings && typeof company.settings === "object" ? (company.settings as Record<string, unknown>) : {}) };
  delete settings.poppy_offer;
  await db
    .from("companies")
    .update({ settings, plan_tier: "poppy", agreed_tier: "poppy", poppy_enabled: true })
    .eq("id", current.company_id);
  await db.from("notifications").delete().eq("company_id", current.company_id).eq("type", "poppy_offer");

  revalidatePath("/billing");
  revalidatePath("/settings");
  return { ok: true };
}

/** Company admin DECLINES a founder's Poppy offer — clears it, nothing changes. */
export async function declinePoppyOffer(): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can do this." };
  const db = createAdminClient();
  const { data: company } = await db.from("companies").select("settings").eq("id", current.company_id).single();
  const settings = { ...(company?.settings && typeof company.settings === "object" ? (company.settings as Record<string, unknown>) : {}) };
  delete settings.poppy_offer;
  await db.from("companies").update({ settings }).eq("id", current.company_id);
  await db.from("notifications").delete().eq("company_id", current.company_id).eq("type", "poppy_offer");
  revalidatePath("/billing");
  return { ok: true };
}

/** Company admin opens the Stripe Customer Portal to manage their subscription. */
export async function openBillingPortal(): Promise<void> {
  const { current } = await requireCompany({ allowSetup: true });
  if (current.role !== "admin") return;
  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("stripe_customer_id, commitment_until, billing_interval")
    .eq("id", current.company_id)
    .single();
  const customerId = company?.stripe_customer_id as string | null;
  if (!customerId) return;
  const committed = company?.commitment_until
    ? new Date(company.commitment_until as string) > new Date()
    : false;
  // Annual plans are paid a year up front, so they're locked in too.
  const locked = committed || company?.billing_interval === "year";
  const url = await createPortalSession(customerId, locked);
  redirect(url);
}
