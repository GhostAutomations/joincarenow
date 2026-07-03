"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentDetails } from "@/lib/documents/fill";

const clean = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Save the company's "Document details" — the shared values (policy owner, HR
 *  contact, approval/review dates) that fill contract & policy placeholders on
 *  download. Merged into companies.settings.document_details. Admin-only. */
export async function saveDocumentDetails(
  input: DocumentDetails
): Promise<{ ok?: boolean; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can change document details." };

  const admin = createAdminClient();
  const { data: co } = await admin.from("companies").select("settings").eq("id", current.company_id).single();

  const document_details: DocumentDetails = {
    policyOwner: clean(input.policyOwner),
    approvedBy: clean(input.approvedBy),
    hrContactName: clean(input.hrContactName),
    hrContactEmail: clean(input.hrContactEmail),
    approvalDate: clean(input.approvalDate, 20),
    reviewDate: clean(input.reviewDate, 20),
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
