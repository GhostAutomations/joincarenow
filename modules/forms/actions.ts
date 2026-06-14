"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const CHOICE_TYPES: FieldType[] = ["dropdown", "radio", "checkboxes"];

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

export async function renameForm(formData: FormData) {
  const id = formData.get("id");
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (typeof id !== "string" || name.length < 2) return;

  const { supabase, current } = await requireCompany();
  await supabase
    .from("forms")
    .update({ name })
    .eq("id", id)
    .eq("company_id", current.company_id);
  revalidatePath(`/forms/${id}`);
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
const fieldSchema = z.object({
  formId: z.string().uuid(),
  label: z.string().min(1, "Field label is required").max(200),
  fieldType: z.enum(FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string()).default([]),
  helpText: z.string().max(300).optional().or(z.literal("")),
});

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
  const parsed = fieldSchema.safeParse({
    formId: formData.get("formId"),
    label: formData.get("label"),
    fieldType: formData.get("fieldType"),
    required: formData.get("required") === "on",
    options: parseOptions(formData.get("options")),
    helpText: formData.get("helpText") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  if (CHOICE_TYPES.includes(parsed.data.fieldType) && parsed.data.options.length === 0) {
    return { error: "Add at least one option (one per line) for this field type." };
  }

  const { supabase, current } = await requireCompany();

  // Ownership check + next position.
  const { data: form } = await supabase
    .from("forms")
    .select("id")
    .eq("id", parsed.data.formId)
    .eq("company_id", current.company_id)
    .single();
  if (!form) return { error: "Form not found" };

  const { data: last } = await supabase
    .from("form_fields")
    .select("position")
    .eq("form_id", parsed.data.formId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("form_fields").insert({
    form_id: parsed.data.formId,
    label: parsed.data.label,
    field_type: parsed.data.fieldType,
    required: parsed.data.required,
    options: parsed.data.options,
    help_text: parsed.data.helpText || null,
    position: nextPos,
  });
  if (error) return { error: "Could not add the field." };

  revalidatePath(`/forms/${parsed.data.formId}`);
  return { ok: true };
}

export async function updateField(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = formData.get("id");
  const parsed = fieldSchema.safeParse({
    formId: formData.get("formId"),
    label: formData.get("label"),
    fieldType: formData.get("fieldType"),
    required: formData.get("required") === "on",
    options: parseOptions(formData.get("options")),
    helpText: formData.get("helpText") ?? "",
  });
  if (typeof id !== "string") return { error: "Missing field id" };
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  if (CHOICE_TYPES.includes(parsed.data.fieldType) && parsed.data.options.length === 0) {
    return { error: "Add at least one option for this field type." };
  }

  const { supabase } = await requireCompany();
  const { error } = await supabase
    .from("form_fields")
    .update({
      label: parsed.data.label,
      field_type: parsed.data.fieldType,
      required: parsed.data.required,
      options: parsed.data.options,
      help_text: parsed.data.helpText || null,
    })
    .eq("id", id);
  if (error) return { error: "Could not save the field." };

  revalidatePath(`/forms/${parsed.data.formId}`);
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
