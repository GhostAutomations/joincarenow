"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocDefaults } from "@/lib/documents/fill";

const clean = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Save the company's "Document details" defaults — the shared values (policy
 *  owner, approver, HR contact, review period) that auto-fill every contract &
 *  policy on download. Dates are derived per-document from its last-saved date,
 *  so they're not stored here. Merged into settings.document_details. Admin-only. */
export async function saveDocumentDetails(
  input: DocDefaults
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change document details." };

  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("settings").eq("id", current.company_id).single();

  const months = Number(input.reviewMonths);
  const document_details: DocDefaults = {
    policyOwner: clean(input.policyOwner),
    approvedBy: clean(input.approvedBy),
    hrContactName: clean(input.hrContactName),
    hrContactEmail: clean(input.hrContactEmail),
    reviewMonths: Number.isFinite(months) && months > 0 ? Math.min(120, Math.round(months)) : 24,
  };

  const settings = {
    ...(co?.settings && typeof co.settings === "object" ? (co.settings as Record<string, unknown>) : {}),
    document_details,
  };
  const { error } = await admin.from("companies").update({ settings }).eq("id", current.company_id);
  if (error) return { error: "Couldn't save document details." };

  revalidatePath("/settings");
  return { ok: true };
}
