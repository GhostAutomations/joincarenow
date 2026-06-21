"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { autoStage } from "@/lib/prospects/auto-stage";

export type UnsubInfo = { companyName: string; opted: boolean } | null;

/** Public: details for the unsubscribe page (token-gated, no login). */
export async function getUnsubInfo(token: string): Promise<UnsubInfo> {
  const db = createAdminClient();
  const { data } = await db
    .from("prospect_contacts")
    .select("opted_out, prospect_companies(name)")
    .eq("unsub_token", token)
    .maybeSingle();
  if (!data) return null;
  const co = data.prospect_companies as unknown as { name: string | null } | null;
  return { companyName: co?.name ?? "us", opted: !!data.opted_out };
}

/** Public: opt a contact out and add them to the global suppression list so
 *  they can never be messaged again. */
export async function optOutByToken(token: string): Promise<{ ok?: boolean; error?: string }> {
  const db = createAdminClient();
  const { data: contact } = await db
    .from("prospect_contacts")
    .select("id, email, phone, prospect_company_id")
    .eq("unsub_token", token)
    .maybeSingle();
  if (!contact) return { error: "Link not found." };

  await db.from("prospect_contacts").update({ opted_out: true }).eq("id", contact.id);
  await db.from("prospect_suppressions").insert({
    email: (contact.email as string) ?? null,
    phone: (contact.phone as string) ?? null,
    reason: "unsubscribe link",
  });
  await autoStage(db, contact.prospect_company_id as string, "optout");
  return { ok: true };
}
