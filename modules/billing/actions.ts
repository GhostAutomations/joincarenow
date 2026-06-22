"use server";

import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCustomer, createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";

/** Company admin starts a subscription checkout (monthly or annual). */
export async function startCheckout(formData: FormData): Promise<void> {
  const { current, profile } = await requireCompany();
  if (current.role !== "admin") return;
  const interval = formData.get("interval") === "year" ? "year" : "month";

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

  const url = await createCheckoutSession({ customerId, companyId: current.company_id, interval });
  redirect(url);
}

/** Company admin opens the Stripe Customer Portal to manage their subscription. */
export async function openBillingPortal(): Promise<void> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return;
  const db = createAdminClient();
  const { data: company } = await db
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", current.company_id)
    .single();
  const customerId = company?.stripe_customer_id as string | null;
  if (!customerId) return;
  const url = await createPortalSession(customerId);
  redirect(url);
}
