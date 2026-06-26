"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany, requireUser, requirePlatformAdmin } from "@/modules/auth/queries";
import { extractFormFields } from "@/lib/ai/extract-form";
import { generateFormFields } from "@/lib/ai/generate-form";
import { recordUsage } from "@/lib/billing/usage";
import { TIERS, tierRank } from "@/modules/forms/tiers";

const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "date",
  "dropdown",
  "radio",
  "checkboxes",
  "yes_no",
  "file",
  "signature",
  "body_text",
  "address",
  "page_break",
  "branch",
  "role",
  "transport",
  "email",
  "phone",
  "month",
  "time",
  "date_range",
  "rating",
  "country",
  "link",
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const CHOICE_TYPES: FieldType[] = ["dropdown", "radio", "checkboxes"];

type FieldData = {
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  help_text: string | null;
  config: Record<string, unknown>;
};

/** Normalise a field submission from the builder (handles body_text styling). */
function buildField(formData: FormData): { error: string } | { value: FieldData } {
  const fieldType = String(formData.get("fieldType") ?? "");
  if (!FIELD_TYPES.includes(fieldType as FieldType)) {
    return { error: "Pick a field type" };
  }
  const ft = fieldType as FieldType;
  const helpText = (formData.get("helpText")?.toString() ?? "").trim();

  if (ft === "body_text") {
    const text = (formData.get("content")?.toString() ?? "").trim();
    if (!text) return { error: "Add the text to display." };
    const heading = (formData.get("label")?.toString() ?? "").trim() || "Information";
    return {
      value: {
        label: heading.slice(0, 200),
        field_type: ft,
        required: false,
        options: [],
        help_text: null,
        config: {
          text: text.slice(0, 5000),
          size: formData.get("fontSize")?.toString() || "normal",
          color: formData.get("fontColor")?.toString() || "#374151",
        },
      },
    };
  }

  const label = (formData.get("label")?.toString() ?? "").trim();
  if (!label) return { error: "Field label is required" };
  const options = parseOptions(formData.get("options"));
  if (CHOICE_TYPES.includes(ft) && options.length === 0) {
    return { error: "Add at least one option (one per line) for this field type." };
  }
  return {
    value: {
      label: label.slice(0, 200),
      field_type: ft,
      required: formData.get("required") === "on",
      options,
      help_text: helpText ? helpText.slice(0, 300) : null,
      config: {},
    },
  };
}

export type FormState = { error?: string; ok?: boolean } | undefined;

// ---------- Create a form ----------
export async function createForm(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the form a name" };

  const { supabase, user, current } = await requireCompany();
  const { data, error } = await supabase
    .from("forms")
    .insert({ company_id: current.company_id, name, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return { error: "Could not create the form." };

  revalidatePath("/forms");
  redirect(`/forms/${data.id}`);
}

/** Create an untitled form and go straight into the builder. */
export async function createBlankForm() {
  const { supabase, user, current } = await requireCompany();
  const { data, error } = await supabase
    .from("forms")
    .insert({ company_id: current.company_id, name: "Untitled form", created_by: user.id })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create the form.");
  revalidatePath("/forms");
  redirect(`/forms/${data.id}`);
}

const CATEGORIES = ["recruitment", "hr", "onboarding", "referencing", "other"];

export type DetailsState = { error?: string; ok?: boolean } | undefined;

/** Details screen: save name + category, then open the builder screen. */
export async function openBuilder(
  _prev: DetailsState,
  formData: FormData
): Promise<DetailsState> {
  const id = formData.get("id");
  const name = (formData.get("name")?.toString() ?? "").trim();
  const categoryRaw = formData.get("category")?.toString() ?? "";
  if (typeof id !== "string") return { error: "Missing form" };
  if (name.length < 2) return { error: "Give the form a name" };
  if (!CATEGORIES.includes(categoryRaw)) return { error: "Please choose a category." };
  const category = categoryRaw;

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("forms")
    .update({ name, category })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not save. Please try again." };

  redirect(`/forms/${id}/build`);
}

/** Builder screen: auto-save the form heading (name + description + styling).
 *  Called programmatically (debounced) from the client — no form button. */
export async function updateFormHeader(payload: {
  id: string;
  name: string;
  description: string;
  style: unknown;
}): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  const name = payload.name.trim() || "Untitled form";
  const { error } = await supabase
    .from("forms")
    .update({
      name,
      description: payload.description?.slice(0, 2000) || null,
      style: payload.style ?? {},
    })
    .eq("id", payload.id);
  if (error) return { ok: false };
  // No revalidatePath: the builder manages its own state optimistically, and a
  // revalidation here would re-render the whole page and cause a visible jump.
  return { ok: true };
}

/** Upload a logo to the public branding bucket; returns its public URL. */
export async function uploadFormLogo(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const id = String(formData.get("id") ?? "");
  const file = formData.get("logo");
  if (!id) return { error: "Missing form" };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image" };
  if (file.size > 2 * 1024 * 1024) return { error: "Logo must be 2MB or smaller" };

  const { supabase } = await requireUser();
  const ext = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "");
  const path = `${id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("branding")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "image/png",
      upsert: true,
    });
  if (error) return { error: "Could not upload the logo. Please try again." };

  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function deleteForm(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const { supabase, current } = await requireCompany();
  await supabase.from("forms").delete().eq("id", id).eq("company_id", current.company_id);
  revalidatePath("/forms");
  redirect("/forms");
}

// ---------- Fields ----------
function parseOptions(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function addField(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const formId = formData.get("formId");
  if (typeof formId !== "string") return { error: "Missing form" };

  const built = buildField(formData);
  if ("error" in built) return { error: built.error };

  const { supabase } = await requireUser();

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .single();
  if (!form) return { error: "Form not found" };

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("form_fields").insert({
    form_id: formId,
    ...built.value,
    position: nextPos,
  });
  if (error) return { error: "Could not add the field." };

  revalidatePath(`/forms/${formId}`);
  return { ok: true };
}

export async function updateField(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id");
  const formId = formData.get("formId");
  if (typeof id !== "string") return { error: "Missing field id" };
  if (typeof formId !== "string") return { error: "Missing form" };

  const built = buildField(formData);
  if ("error" in built) return { error: built.error };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("form_fields")
    .update(built.value)
    .eq("id", id);
  if (error) return { error: "Could not save the field." };

  revalidatePath(`/forms/${formId}`);
  return { ok: true };
}

/** Default values for a freshly-inserted field of a given type. */
function defaultField(ft: FieldType): FieldData {
  if (ft === "body_text") {
    return {
      label: "Information",
      field_type: ft,
      required: false,
      options: [],
      help_text: null,
      config: { text: "Add your text here", size: "normal", color: "#374151" },
    };
  }
  if (CHOICE_TYPES.includes(ft)) {
    return {
      label: "",
      field_type: ft,
      required: false,
      options: ["Option 1"],
      help_text: null,
      config: {},
    };
  }
  if (ft === "address") {
    return { label: "Address", field_type: ft, required: false, options: [], help_text: null, config: {} };
  }
  if (ft === "page_break") {
    return { label: "Page break", field_type: ft, required: false, options: [], help_text: null, config: {} };
  }
  // Managed-option fields: options come from company lists / fixed at render.
  if (ft === "branch") {
    return { label: "Branch", field_type: ft, required: false, options: [], help_text: null, config: {} };
  }
  if (ft === "role") {
    return { label: "Role", field_type: ft, required: false, options: [], help_text: null, config: {} };
  }
  if (ft === "transport") {
    return { label: "Transport", field_type: ft, required: false, options: [], help_text: null, config: {} };
  }
  return {
    label: "",
    field_type: ft,
    required: false,
    options: [],
    help_text: null,
    config: {},
  };
}

/** Insert a field of the chosen type after `afterId` ("" = top), then reindex.
 *  Returns the new field's id so the builder can select it. */
export async function addFieldOfType(formData: FormData): Promise<string | null> {
  const formId = String(formData.get("formId") ?? "");
  let afterId = String(formData.get("afterId") ?? "");
  const ft = String(formData.get("fieldType") ?? "") as FieldType;
  // Optional: this field is a follow-up shown when parentFieldId == parentValue.
  const parentFieldId = String(formData.get("parentFieldId") ?? "") || null;
  const parentValue = parentFieldId ? String(formData.get("parentValue") ?? "") : null;
  if (parentFieldId) afterId = parentFieldId;
  if (!formId || !FIELD_TYPES.includes(ft)) return null;

  const { supabase } = await requireUser();
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .single();
  if (!form) return null;

  const { data: existing } = await supabase
    .from("form_fields")
    .select("id")
    .eq("form_id", formId)
    .order("position", { ascending: true });
  const ids = (existing ?? []).map((e) => e.id);

  const { data: created, error } = await supabase
    .from("form_fields")
    .insert({
      form_id: formId,
      ...defaultField(ft),
      parent_field_id: parentFieldId,
      parent_value: parentValue,
      position: ids.length,
    })
    .select("id")
    .single();
  if (error || !created) return null;

  const idx = afterId ? ids.indexOf(afterId) + 1 : ids.length;
  ids.splice(idx, 0, created.id);
  await Promise.all(
    ids.map((fid, i) =>
      supabase.from("form_fields").update({ position: i }).eq("id", fid)
    )
  );

  // No revalidatePath — keeps the builder from re-rendering/jumping on add.
  return created.id;
}

/** Insert a field pre-filled from a question-bank template. Returns the id. */
export async function addFieldFromTemplate(formData: FormData): Promise<string | null> {
  const formId = String(formData.get("formId") ?? "");
  const afterId = String(formData.get("afterId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!formId || !templateId) return null;

  const { supabase } = await requireUser();
  const { data: form } = await supabase.from("forms").select("id").eq("id", formId).single();
  if (!form) return null;

  const { data: tpl } = await supabase
    .from("question_templates")
    .select("label, field_type, options, help_text")
    .eq("id", templateId)
    .single();
  if (!tpl) return null;

  const { data: existing } = await supabase
    .from("form_fields")
    .select("id")
    .eq("form_id", formId)
    .order("position", { ascending: true });
  const ids = (existing ?? []).map((e) => e.id);

  const { data: created, error } = await supabase
    .from("form_fields")
    .insert({
      form_id: formId,
      label: tpl.label,
      field_type: tpl.field_type,
      options: tpl.options ?? [],
      help_text: tpl.help_text,
      required: false,
      config: {},
      position: ids.length,
    })
    .select("id")
    .single();
  if (error || !created) return null;

  const idx = afterId ? ids.indexOf(afterId) + 1 : ids.length;
  ids.splice(idx, 0, created.id);
  await Promise.all(
    ids.map((fid, i) => supabase.from("form_fields").update({ position: i }).eq("id", fid))
  );
  return created.id;
}

/** Persist a new field order (from drag-and-drop). */
export async function reorderFields(formId: string, orderedIds: string[]) {
  if (!formId || !Array.isArray(orderedIds)) return;
  const { supabase } = await requireUser();
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .single();
  if (!form) return;
  await Promise.all(
    orderedIds.map((fid, i) =>
      supabase.from("form_fields").update({ position: i }).eq("id", fid).eq("form_id", formId)
    )
  );
  // No revalidatePath — reorder is reflected in the builder's local state.
}

export async function deleteField(formData: FormData) {
  const id = formData.get("id");
  const formId = formData.get("formId");
  if (typeof id !== "string") return;
  const { supabase } = await requireUser();
  await supabase.from("form_fields").delete().eq("id", id);
  if (typeof formId === "string") revalidatePath(`/forms/${formId}`);
}

// ---------- Import fields from a PDF (AI-assisted) ----------
export type ImportState = { error?: string; added?: number } | undefined;

export async function importFormFromPdf(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const formId = formData.get("formId");
  const file = formData.get("pdf");
  if (typeof formId !== "string") return { error: "Missing form" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF to upload." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Please upload a PDF file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "The PDF must be 10MB or smaller." };
  }

  const { supabase } = await requireUser();
  const { data: form } = await supabase
    .from("forms")
    .select("id, company_id")
    .eq("id", formId)
    .single();
  if (!form) return { error: "Form not found" };

  let fields;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    fields = await extractFormFields(base64);
    await recordUsage(form.company_id as string | null, "ai");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read that PDF." };
  }
  if (fields.length === 0) {
    return { error: "No questions were found in that PDF." };
  }

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (last?.position ?? -1) + 1;

  const rows = fields.map((f) => ({
    form_id: formId,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    options: f.options,
    help_text: f.help_text,
    position: pos++,
  }));

  const { error } = await supabase.from("form_fields").insert(rows);
  if (error) return { error: "Could not save the imported fields." };

  revalidatePath(`/forms/${formId}`);
  return { added: fields.length };
}

/** Generate form questions from a plain-English brief with AI and append them
 *  to the form (for the builder to review/edit). Mirrors importFormFromPdf. */
export async function generateFormFromBrief(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const formId = formData.get("formId");
  const brief = (formData.get("brief")?.toString() ?? "").trim();
  if (typeof formId !== "string") return { error: "Missing form" };
  if (brief.length < 3) return { error: "Describe the form you want first." };

  const { supabase } = await requireUser();
  const { data: form } = await supabase
    .from("forms")
    .select("id, company_id, name")
    .eq("id", formId)
    .single();
  if (!form) return { error: "Form not found" };

  let fields;
  try {
    fields = await generateFormFields(brief, form.name as string | undefined);
    await recordUsage(form.company_id as string | null, "ai");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate the form." };
  }
  if (fields.length === 0) {
    return { error: "The AI didn't return any questions. Try rephrasing." };
  }

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pos = (last?.position ?? -1) + 1;

  const rows = fields.map((f) => ({
    form_id: formId,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    options: f.options,
    help_text: f.help_text,
    position: pos++,
  }));

  const { error } = await supabase.from("form_fields").insert(rows);
  if (error) return { error: "Could not save the generated questions." };

  revalidatePath(`/forms/${formId}`);
  return { added: fields.length };
}

// ============================================================
// FORM STORE (founder templates + admin acquire + company tiers)
// ============================================================

/** Founder: create a blank store template and open the builder. */
export async function createBlankStoreForm() {
  const { supabase, user } = await requirePlatformAdmin();
  const { data, error } = await supabase
    .from("forms")
    .insert({ name: "Untitled form", is_store: true, company_id: null, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create the form.");
  revalidatePath("/admin/forms");
  redirect(`/admin/forms/${data.id}/build`);
}

/** Founder: save a store form's category + required subscription tier. */
export async function saveStoreSettings(
  _prev: DetailsState,
  formData: FormData
): Promise<DetailsState> {
  const id = formData.get("id");
  const name = (formData.get("name")?.toString() ?? "").trim();
  const categoryRaw = formData.get("category")?.toString() ?? "";
  const tierRaw = formData.get("storeTier")?.toString() ?? "free";
  if (typeof id !== "string") return { error: "Missing form" };
  if (name.length < 2) return { error: "Give the form a name." };
  if (!CATEGORIES.includes(categoryRaw)) return { error: "Please choose a category." };
  const category = categoryRaw;
  const store_tier = TIERS.includes(tierRaw) ? tierRaw : "free";

  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase
    .from("forms")
    .update({ name, category, store_tier })
    .eq("id", id)
    .eq("is_store", true);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath(`/admin/forms/${id}/build`);
  return { ok: true };
}

/** Founder: publish or unpublish a store template. Publishing makes it appear in
 *  every company's Form Store; it requires a real name + a category first. */
export async function setStorePublished(
  _prev: DetailsState,
  formData: FormData
): Promise<DetailsState> {
  const id = formData.get("id");
  const publish = formData.get("publish") === "true";
  if (typeof id !== "string") return { error: "Missing form" };

  const { supabase } = await requirePlatformAdmin();

  if (publish) {
    const { data: f } = await supabase
      .from("forms")
      .select("name, category")
      .eq("id", id)
      .eq("is_store", true)
      .single();
    if (!f) return { error: "Form not found" };
    const name = (f.name as string | null)?.trim() ?? "";
    if (!name || name.toLowerCase() === "untitled form") return { error: "Give the form a name before publishing." };
    if (!f.category) return { error: "Choose a category before publishing." };
  }

  const { error } = await supabase
    .from("forms")
    .update({ store_published: publish })
    .eq("id", id)
    .eq("is_store", true);
  if (error) return { error: "Could not update. Please try again." };
  revalidatePath(`/admin/forms/${id}/build`);
  revalidatePath("/admin/forms");
  return { ok: true };
}

/** Founder: delete a store template. */
export async function deleteStoreForm(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const { supabase } = await requirePlatformAdmin();
  await supabase.from("forms").delete().eq("id", id).eq("is_store", true);
  revalidatePath("/admin/forms");
  redirect("/admin/forms");
}

/** Founder: delete several store templates at once (from the Form Store list). */
export async function deleteStoreFormsBulk(ids: string[]): Promise<{ ok?: boolean; error?: string }> {
  const clean = (ids ?? []).filter((x) => typeof x === "string" && x);
  if (clean.length === 0) return { error: "Nothing selected." };
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.from("forms").delete().in("id", clean).eq("is_store", true);
  if (error) return { error: "Could not delete the selected templates." };
  revalidatePath("/admin/forms");
  return { ok: true };
}

/** Founder: set a company's subscription tier. */
export async function setCompanyTier(formData: FormData) {
  const companyId = formData.get("companyId");
  const tierRaw = formData.get("tier")?.toString() ?? "free";
  if (typeof companyId !== "string") return;
  const tier = TIERS.includes(tierRaw) ? tierRaw : "free";
  const { supabase } = await requirePlatformAdmin();
  await supabase.from("companies").update({ subscription_tier: tier }).eq("id", companyId);
  revalidatePath("/admin");
}

/** Copy one store template into the company's own forms (tier-gated).
 *  Returns the new form id, or null if not allowed / not found. */
async function acquireOne(storeId: string): Promise<string | null> {
  const { supabase, user, current } = await requireCompany();
  if (current.role !== "admin") return null;

  const { data: company } = await supabase
    .from("companies")
    .select("subscription_tier")
    .eq("id", current.company_id)
    .single();
  const { data: store } = await supabase
    .from("forms")
    .select("id, name, description, style, category, store_tier")
    .eq("id", storeId)
    .eq("is_store", true)
    .single();
  if (!store) return null;
  if (tierRank(company?.subscription_tier ?? "free") < tierRank(store.store_tier)) return null;

  const { data: copy } = await supabase
    .from("forms")
    .insert({
      company_id: current.company_id,
      name: store.name,
      description: store.description,
      style: store.style ?? {},
      category: store.category,
      is_store: false,
      source_form_id: store.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (!copy) return null;

  const { data: fields } = await supabase
    .from("form_fields")
    .select("label, field_type, required, options, help_text, config, position")
    .eq("form_id", storeId)
    .order("position", { ascending: true });
  if (fields && fields.length) {
    await supabase
      .from("form_fields")
      .insert(fields.map((f) => ({ ...f, form_id: copy.id })));
  }
  return copy.id;
}

/** Admin: "Customise and add" — copy then open the builder. */
export async function acquireStoreForm(formData: FormData) {
  const storeId = formData.get("storeFormId");
  if (typeof storeId !== "string") return;
  const id = await acquireOne(storeId);
  revalidatePath("/forms");
  if (id) redirect(`/forms/${id}/build`);
}

/** Admin: "Add to my forms" — copy without leaving the store. */
export async function addStoreForm(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const storeId = formData.get("storeFormId");
  if (typeof storeId !== "string") return { error: "Missing form" };
  const id = await acquireOne(storeId);
  if (!id) return { error: "Could not add this form (check your plan)." };
  revalidatePath("/forms");
  return { ok: true };
}

/** Admin: add several store forms at once. */
export async function addStoreFormsBulk(ids: string[]): Promise<{ added: number }> {
  let added = 0;
  for (const id of ids) {
    const made = await acquireOne(id);
    if (made) added++;
  }
  revalidatePath("/forms");
  return { added };
}

/** Fields + meta for previewing a store form (read-only). */
export async function getStoreFormPreview(storeId: string) {
  const { supabase } = await requireCompany();
  const { data: form } = await supabase
    .from("forms")
    .select("name, description, style")
    .eq("id", storeId)
    .eq("is_store", true)
    .single();
  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, required, options, help_text, config, parent_field_id, parent_value, position")
    .eq("form_id", storeId)
    .order("position", { ascending: true });
  return {
    form: {
      name: form?.name ?? "Form",
      description: (form as { description?: string } | null)?.description ?? "",
      style: ((form as { style?: Record<string, unknown> } | null)?.style ?? {}) as never,
    },
    fields: (fields ?? []).map((f) => ({
      field_id: f.id as string,
      label: f.label as string,
      field_type: f.field_type as string,
      required: f.required as boolean,
      options: (f.options ?? []) as string[],
      help_text: (f.help_text as string | null) ?? null,
      config: (f.config ?? null) as { text?: string; size?: string; color?: string } | null,
      parent_field_id: (f.parent_field_id as string | null) ?? null,
      parent_value: (f.parent_value as string | null) ?? null,
      field_position: (f.position as number) ?? 0,
    })),
  };
}

export async function moveField(formData: FormData) {
  const id = formData.get("id");
  const formId = formData.get("formId");
  const direction = formData.get("direction");
  if (typeof id !== "string" || typeof formId !== "string") return;
  if (direction !== "up" && direction !== "down") return;

  const { supabase } = await requireUser();
  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, position")
    .eq("form_id", formId)
    .order("position", { ascending: true });
  if (!fields) return;

  const idx = fields.findIndex((f) => f.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= fields.length) return;

  const a = fields[idx];
  const b = fields[swapIdx];
  await supabase.from("form_fields").update({ position: b.position }).eq("id", a.id);
  await supabase.from("form_fields").update({ position: a.position }).eq("id", b.id);

  revalidatePath(`/forms/${formId}`);
}
