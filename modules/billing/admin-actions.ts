"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscription } from "@/lib/billing/stripe";
import { runUsageReport } from "@/lib/billing/report-usage";

/** Founder: give or remove complimentary (free) access for a company. */
export async function founderCompToggle(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const comp = formData.get("comp") === "true";
  const db = createAdminClient();
  await db.from("companies").update({ billing_comped: comp }).eq("id", id);
  revalidatePath(`/admin/billing/${id}`);
  revalidatePath("/admin/billing");
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
  revalidatePath(`/admin/billing/${id}`);
  revalidatePath("/admin/billing");
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
  revalidatePath(`/admin/billing/${id}`);
  revalidatePath("/admin/billing");
}

/** Founder: push all unreported usage to Stripe now. */
export async function founderRunUsageReport(): Promise<void> {
  await requirePlatformAdmin();
  await runUsageReport();
  revalidatePath("/admin/billing");
}
