"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { generateContractDraft } from "@/lib/ai/generate-contract";
import { generatePolicyDraft } from "@/lib/ai/generate-policy";

export type DocResult = { ok?: boolean; error?: string; id?: string };

const TABLE = {
  contract: "contract_templates",
  policy: "policy_documents",
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
  if (current.role !== "admin") return { error: "Only admins can manage contracts and policies." };
  const table = TABLE[kind];

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
      .update({ name, body, version: nextVersion, signature_method: signatureMethod })
      .eq("id", id)
      .eq("company_id", current.company_id);
    if (error) return { error: "Could not save your changes." };
    revalidatePath("/settings");
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ company_id: current.company_id, name, body, signature_method: signatureMethod, created_by: user.id })
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
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate the policy." };
  }
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
