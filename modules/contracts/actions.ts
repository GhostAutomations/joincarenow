"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateContractDraft } from "@/lib/ai/generate-contract";
import { generatePolicyDraft } from "@/lib/ai/generate-policy";
import { recordUsage } from "@/lib/billing/usage";

export type DocResult = { ok?: boolean; error?: string; id?: string };

const TABLE = {
  contract: "contract_templates",
  policy: "policy_documents",
  job_description: "job_descriptions",
} as const;

type Kind = keyof typeof TABLE;

/** Create or update a contract template / policy document. Editing an existing
 *  doc bumps its version so already-signed copies (which snapshot the text)
 *  stay intact. Admin-only (enforced by RLS). */
export async function saveDoc(kind: Kind, formData: FormData): Promise<DocResult> {
  const id = formData.get("id")?.toString() || null;
  const name = (formData.get("name")?.toString() ?? "").trim();
  const body = formData.get("body")?.toString() ?? "";
  const signatureMethod = formData.get("signature_method")?.toString() === "draw" ? "draw" : "type";
  if (name.length < 2) return { error: "Give the document a name." };

  const { supabase, current, user } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can manage these documents." };
  const table = TABLE[kind];
  // Job descriptions have no signature method (they aren't signed).
  const sig = kind === "job_description" ? {} : { signature_method: signatureMethod };

  if (id) {
    // Bump the version on edit.
    const { data: existing } = await supabase
      .from(table)
      .select("version")
      .eq("id", id)
      .eq("company_id", current.company_id)
      .maybeSingle();
    const nextVersion = ((existing?.version as number) ?? 1) + 1;
    const { error } = await supabase
      .from(table)
      .update({ name, body, version: nextVersion, ...sig })
      .eq("id", id)
      .eq("company_id", current.company_id);
    if (error) return { error: "Could not save your changes." };
    revalidatePath("/settings");
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ company_id: current.company_id, name, body, ...sig, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: "Could not create the document." };
  revalidatePath("/settings");
  return { ok: true, id: data.id as string };
}

/** AI-draft a UK care-sector employment contract template (admin only). Returns
 *  the generated text for the editor to drop in — nothing is saved here. */
export async function generateContract(
  brief: string
): Promise<{ text?: string; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can generate contracts." };
  try {
    const text = await generateContractDraft(brief ?? "");
    await recordUsage(current.company_id, "ai");
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate the contract." };
  }
}

/** AI-draft a UK care-sector policy document (admin only). The name sets the
 *  topic; brief adds specifics. Returns the text for the editor to drop in. */
export async function generatePolicy(
  name: string,
  brief: string
): Promise<{ text?: string; error?: string }> {
  const { current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can generate policies." };
  try {
    const text = await generatePolicyDraft(name ?? "", brief ?? "");
    await recordUsage(current.company_id, "ai");
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate the policy." };
  }
}

/** Founder: create/update a doc for a company they're setting up (admin client,
 *  platform-admin only). Same shape as saveDoc; companyId comes from the form. */
export async function saveFounderDoc(kind: Kind, formData: FormData): Promise<DocResult> {
  await requirePlatformAdmin();
  const companyId = formData.get("companyId")?.toString() || "";
  const id = formData.get("id")?.toString() || null;
  const name = (formData.get("name")?.toString() ?? "").trim();
  const body = formData.get("body")?.toString() ?? "";
  const signatureMethod = formData.get("signature_method")?.toString() === "draw" ? "draw" : "type";
  if (!companyId) return { error: "Missing company." };
  if (name.length < 2) return { error: "Give the document a name." };

  const db = createAdminClient();
  const table = TABLE[kind];
  const sig = kind === "job_description" ? {} : { signature_method: signatureMethod };

  if (id) {
    const { data: existing } = await db.from(table).select("version").eq("id", id).eq("company_id", companyId).maybeSingle();
    const nextVersion = ((existing?.version as number) ?? 1) + 1;
    const { error } = await db.from(table).update({ name, body, version: nextVersion, ...sig }).eq("id", id).eq("company_id", companyId);
    if (error) return { error: "Could not save your changes." };
    revalidatePath(`/founder/companies/${companyId}`);
    return { ok: true, id };
  }

  const { data, error } = await db
    .from(table)
    .insert({ company_id: companyId, name, body, ...sig, created_by: null })
    .select("id")
    .single();
  if (error) return { error: "Could not create the document." };
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true, id: data.id as string };
}

/** Founder: delete a company's doc (platform-admin only). */
export async function deleteFounderDoc(kind: Kind, companyId: string, id: string): Promise<DocResult> {
  await requirePlatformAdmin();
  if (!companyId || !id) return { error: "Missing document." };
  const db = createAdminClient();
  const { error } = await db.from(TABLE[kind]).delete().eq("id", id).eq("company_id", companyId);
  if (error) return { error: "Could not delete the document." };
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
}

export async function deleteDoc(kind: Kind, id: string): Promise<DocResult> {
  if (!id) return { error: "Missing document." };
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can manage contracts and policies." };
  const { error } = await supabase
    .from(TABLE[kind])
    .delete()
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not delete the document." };
  revalidatePath("/settings");
  return { ok: true };
}
