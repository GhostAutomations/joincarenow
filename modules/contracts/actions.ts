"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateContractDraft } from "@/lib/ai/generate-contract";
import { generatePolicyDraft } from "@/lib/ai/generate-policy";
import { recordUsage } from "@/lib/billing/usage";
import { chargeOneOff } from "@/lib/billing/stripe";

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
  const smRaw = formData.get("signature_method")?.toString();
  const signatureMethod = smRaw === "draw" ? "draw" : smRaw === "none" ? "none" : "type";
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
  const { current, user } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can generate contracts." };
  try {
    const text = await generateContractDraft(brief ?? "");
    await recordUsage(current.company_id, "ai", 1, { label: "Contract", actorId: user.id });
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
  const { current, user } = await requireCompany();
  if (current.role !== "admin") return { error: "Only admins can generate policies." };
  try {
    const text = await generatePolicyDraft(name ?? "", brief ?? "");
    await recordUsage(current.company_id, "ai", 1, { label: "Policy", actorId: user.id });
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
  const smRaw = formData.get("signature_method")?.toString();
  const signatureMethod = smRaw === "draw" ? "draw" : smRaw === "none" ? "none" : "type";
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

// ============================================================
// FILE STORE — contracts / policies / job descriptions (0150)
// Mirrors the Form Store: founder curates priced store rows (company_id NULL,
// is_store), companies deep-copy them in (source_id decouples the copy).
// ============================================================

const PURCHASE_TABLE = {
  contract: "contract_purchases",
  policy: "policy_purchases",
  job_description: "job_description_purchases",
} as const;

const NOUN: Record<Kind, string> = {
  contract: "contract",
  policy: "policy",
  job_description: "job description",
};

function isKind(k: unknown): k is Kind {
  return k === "contract" || k === "policy" || k === "job_description";
}

/** contract -> contracts, policy -> policies, job_description -> jobdescriptions.
 *  Used for the File Store tab a founder returns to. */
function storeTab(kind: Kind): string {
  return kind === "contract" ? "contracts" : kind === "policy" ? "policies" : "jobdescriptions";
}

export type StoreDocState = { ok?: boolean; error?: string };

/** Founder: create a blank store doc of the given kind and open its builder. */
export async function createBlankStoreDoc(formData: FormData) {
  const kind = formData.get("kind")?.toString();
  if (!isKind(kind)) throw new Error("Unknown document type.");
  const { supabase, user } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .insert({
      is_store: true,
      company_id: null,
      name: `Untitled ${NOUN[kind]}`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create the document.");
  revalidatePath("/founder/forms");
  redirect(`/founder/store/${kind}/${data.id as string}`);
}

/** Founder: save a store doc's name + body (+ signature method for contracts /
 *  policies). Shape matches DocEditorForm's SaveAction so the editor is reused. */
export async function saveStoreDoc(kind: Kind, formData: FormData): Promise<DocResult> {
  if (!isKind(kind)) return { error: "Unknown document type." };
  const id = formData.get("id")?.toString() || null;
  const name = (formData.get("name")?.toString() ?? "").trim();
  const body = formData.get("body")?.toString() ?? "";
  const smRaw = formData.get("signature_method")?.toString();
  const signatureMethod = smRaw === "draw" ? "draw" : smRaw === "none" ? "none" : "type";
  if (name.length < 2) return { error: "Give the document a name." };

  const { supabase } = await requirePlatformAdmin();
  const table = TABLE[kind];
  // Job descriptions aren't signed, so they have no signature_method column.
  const sig = kind === "job_description" ? {} : { signature_method: signatureMethod };

  if (id) {
    const { error } = await supabase
      .from(table)
      .update({ name, body, ...sig })
      .eq("id", id)
      .eq("is_store", true);
    if (error) return { error: "Could not save your changes." };
    revalidatePath(`/founder/store/${kind}/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ is_store: true, company_id: null, name, body, ...sig })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the document." };
  return { ok: true, id: data.id as string };
}

/** Founder: save a store doc's category + one-off price (auto-saved as you type).
 *  A name + category are only *required to publish* (see setStoreDocPublished). */
export async function saveStoreDocDetails(
  _prev: StoreDocState,
  formData: FormData
): Promise<StoreDocState> {
  const kind = formData.get("kind")?.toString();
  const id = formData.get("id")?.toString();
  if (!isKind(kind)) return { error: "Unknown document type." };
  if (!id) return { error: "Missing document." };

  const categoryRaw = (formData.get("category")?.toString() ?? "").trim();
  const priceRaw = (formData.get("price")?.toString() ?? "").trim();
  let pricePence = 0;
  if (priceRaw) {
    const pounds = Number(priceRaw.replace(/[£,\s]/g, ""));
    if (!Number.isFinite(pounds) || pounds < 0) return { error: "Enter a valid price." };
    pricePence = Math.round(pounds * 100);
  }

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ price_pence: pricePence, store_category: categoryRaw || null })
    .eq("id", id)
    .eq("is_store", true);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath(`/founder/store/${kind}/${id}`);
  return { ok: true };
}

/** Founder: publish / unpublish a store doc. Publishing needs a real name + a
 *  category so the store card renders properly. */
export async function setStoreDocPublished(
  _prev: StoreDocState,
  formData: FormData
): Promise<StoreDocState> {
  const kind = formData.get("kind")?.toString();
  const id = formData.get("id")?.toString();
  const publish = formData.get("publish") === "true";
  if (!isKind(kind)) return { error: "Unknown document type." };
  if (!id) return { error: "Missing document." };

  const { supabase } = await requirePlatformAdmin();
  const table = TABLE[kind];

  if (publish) {
    const { data: d } = await supabase
      .from(table)
      .select("name, store_category")
      .eq("id", id)
      .eq("is_store", true)
      .single();
    if (!d) return { error: "Document not found." };
    const name = (d.name as string | null)?.trim() ?? "";
    if (!name || name.toLowerCase().startsWith("untitled")) {
      return { error: "Give the document a name before publishing." };
    }
    if (!d.store_category) return { error: "Choose a category before publishing." };
  }

  const { error } = await supabase
    .from(table)
    .update({ store_published: publish })
    .eq("id", id)
    .eq("is_store", true);
  if (error) return { error: "Could not update. Please try again." };
  revalidatePath(`/founder/store/${kind}/${id}`);
  revalidatePath("/founder/forms");
  return { ok: true };
}

/** Founder: delete a store doc. */
export async function deleteStoreDoc(formData: FormData) {
  const kind = formData.get("kind")?.toString();
  const id = formData.get("id")?.toString();
  if (!isKind(kind) || !id) return;
  const { supabase } = await requirePlatformAdmin();
  await supabase.from(TABLE[kind]).delete().eq("id", id).eq("is_store", true);
  revalidatePath("/founder/forms");
  redirect(`/founder/forms?tab=${storeTab(kind)}`);
}

/** Founder: delete several store docs of one kind at once. */
export async function deleteStoreDocsBulk(kind: Kind, ids: string[]): Promise<StoreDocState> {
  if (!isKind(kind)) return { error: "Unknown document type." };
  const clean = (ids ?? []).filter((x) => typeof x === "string" && x);
  if (clean.length === 0) return { error: "Nothing selected." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.from(TABLE[kind]).delete().in("id", clean).eq("is_store", true);
  if (error) return { error: "Could not delete the selected templates." };
  revalidatePath("/founder/forms");
  return { ok: true };
}

/** Name + body of a store doc, for the read-only preview modal. */
export async function getStoreDocPreview(
  kind: Kind,
  id: string
): Promise<{ name: string; body: string } | null> {
  if (!isKind(kind)) return null;
  const { supabase } = await requireCompany();
  const { data } = await supabase
    .from(TABLE[kind])
    .select("name, body")
    .eq("id", id)
    .eq("is_store", true)
    .single();
  if (!data) return null;
  return { name: (data.name as string) ?? "", body: (data.body as string) ?? "" };
}

type AcquireDocResult = { id?: string; error?: string };

/** Copy one store doc into the company's own library. Free docs copy straight
 *  away; paid docs charge the saved card once, record the purchase, then copy.
 *  Idempotent: a doc already bought/copied is never re-charged — the existing
 *  copy is returned. Mirrors forms' acquireOne. */
async function acquireDoc(kind: Kind, storeId: string): Promise<AcquireDocResult> {
  if (!isKind(kind)) return { error: "Unknown document type." };
  const { supabase, user, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only an admin can add Store items." };

  const table = TABLE[kind];
  const cols =
    kind === "job_description"
      ? "id, name, body, price_pence"
      : "id, name, body, price_pence, signature_method";
  const { data: store } = await supabase
    .from(table)
    .select(cols)
    .eq("id", storeId)
    .eq("is_store", true)
    .single();
  if (!store) return { error: "That item is no longer available." };
  const s = store as unknown as {
    id: string;
    name: string;
    body: string | null;
    price_pence: number | null;
    signature_method?: string;
  };

  // Already have a copy of this store item? Return it — never re-charge.
  const { data: existingCopy } = await supabase
    .from(table)
    .select("id")
    .eq("company_id", current.company_id)
    .eq("source_id", s.id)
    .limit(1)
    .maybeSingle();
  if (existingCopy?.id) return { id: existingCopy.id as string };

  const price = s.price_pence ?? 0;

  // Paid item → charge before copying.
  let invoiceId: string | null = null;
  if (price > 0) {
    const { data: company } = await supabase
      .from("companies")
      .select("billing_status, billing_comped, stripe_customer_id")
      .eq("id", current.company_id)
      .single();
    const comped = company?.billing_comped === true;
    const status = (company?.billing_status as string) ?? "none";
    const active = status === "active" || status === "trialing";
    const customerId = company?.stripe_customer_id as string | null;

    if (!comped) {
      if (!active || !customerId) {
        return { error: "Set up billing with a saved card before buying paid items." };
      }
      try {
        const r = await chargeOneOff(customerId, price, `File Store: ${s.name}`);
        invoiceId = r.invoiceId;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Payment could not be completed." };
      }
    }
    // comped companies get paid items at no charge (founder concession).
  }

  const sig =
    kind === "job_description"
      ? {}
      : { signature_method: s.signature_method === "draw" ? "draw" : s.signature_method === "none" ? "none" : "type" };

  const { data: copy, error: copyErr } = await supabase
    .from(table)
    .insert({
      company_id: current.company_id,
      name: s.name,
      body: s.body ?? "",
      ...sig,
      is_store: false,
      source_id: s.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (copyErr || !copy) return { error: "Could not add the item. Please try again." };

  // Record the purchase (audit + idempotency). Best-effort: the item is already
  // theirs, so a logging hiccup must not undo a successful charge.
  if (price > 0) {
    const admin = createAdminClient();
    await admin.from(PURCHASE_TABLE[kind]).insert({
      company_id: current.company_id,
      store_id: s.id,
      copy_id: copy.id,
      price_pence: invoiceId ? price : 0,
      stripe_invoice_id: invoiceId,
      purchased_by: user.id,
    });
  }

  return { id: copy.id as string };
}

/** Company admin: "Add" / "Buy & add" a store doc in place. */
export async function addStoreDoc(
  _prev: StoreDocState | undefined,
  formData: FormData
): Promise<StoreDocState> {
  const kind = formData.get("kind")?.toString();
  const storeId = formData.get("storeId")?.toString();
  if (!isKind(kind)) return { error: "Unknown document type." };
  if (!storeId) return { error: "Missing item." };
  const r = await acquireDoc(kind, storeId);
  if (r.error) return { error: r.error };
  revalidatePath("/settings");
  revalidatePath("/store");
  return { ok: true };
}

/** Company admin: "Customise" a FREE store doc — copy it then open the editor. */
export async function acquireStoreDocCustomise(formData: FormData) {
  const kind = formData.get("kind")?.toString();
  const storeId = formData.get("storeId")?.toString();
  if (!isKind(kind) || !storeId) return;
  const r = await acquireDoc(kind, storeId);
  revalidatePath("/settings");
  if (r.id) redirect(`/settings/documents/${kind}/${r.id}`);
}

/** Company admin: add several FREE store docs of one kind at once. Paid docs are
 *  skipped — they must be bought one at a time so the charge is always explicit. */
export async function addStoreDocsBulk(
  kind: Kind,
  ids: string[]
): Promise<{ added: number; skippedPaid: number }> {
  if (!isKind(kind)) return { added: 0, skippedPaid: 0 };
  const { supabase } = await requireCompany();
  let added = 0;
  let skippedPaid = 0;
  for (const id of ids) {
    const { data: d } = await supabase
      .from(TABLE[kind])
      .select("price_pence")
      .eq("id", id)
      .eq("is_store", true)
      .maybeSingle();
    if (((d?.price_pence as number) ?? 0) > 0) {
      skippedPaid++;
      continue;
    }
    const made = await acquireDoc(kind, id);
    if (made.id) added++;
  }
  revalidatePath("/settings");
  revalidatePath("/store");
  return { added, skippedPaid };
}
