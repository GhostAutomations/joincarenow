"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { extractFormFields } from "@/lib/ai/extract-form";

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

const CATEGORIES = ["recruitment", "hr", "onboarding", "other"];

export type DetailsState = { error?: string; ok?: boolean } | undefined;

/** Save a form's name + category from the builder header. */
export async function saveFormDetails(
  _prev: DetailsState,
  formData: FormData
): Promise<DetailsState> {
  const id = formData.get("id");
  const name = (formData.get("name")?.toString() ?? "").trim();
  const categoryRaw = formData.get("category")?.toString() ?? "recruitment";
  if (typeof id !== "string") return { error: "Missing form" };
  if (name.length < 2) return { error: "Give the form a name" };
  const category = CATEGORIES.includes(categoryRaw) ? categoryRaw : "other";

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("forms")
    .update({ name, category })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath(`/forms/${id}`);
  return { ok: true };
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

  const { supabase, current } = await requireCompany();

  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("company_id", current.company_id)
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

  const { supabase } = await requireCompany();
  const { error } = await supabase
    .from("form_fields")
    .update(built.value)
    .eq("id", id);
  if (error) return { error: "Could not save the field." };

  revalidatePath(`/forms/${formId}`);
  return { ok: true };
}

export async function deleteField(formData: FormData) {
  const id = formData.get("id");
  const formId = formData.get("formId");
  if (typeof id !== "string") return;
  const { supabase } = await requireCompany();
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

  const { supabase, current } = await requireCompany();
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", formId)
    .eq("company_id", current.company_id)
    .single();
  if (!form) return { error: "Form not found" };

  let fields;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    fields = await extractFormFields(base64);
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

export async function moveField(formData: FormData) {
  const id = formData.get("id");
  const formId = formData.get("formId");
  const direction = formData.get("direction");
  if (typeof id !== "string" || typeof formId !== "string") return;
  if (direction !== "up" && direction !== "down") return;

  const { supabase } = await requireCompany();
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
