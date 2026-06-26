"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";

export type QuestionState = { error?: string; ok?: boolean } | undefined;

const CHOICE = ["dropdown", "radio", "checkboxes"];

/** Founder-only: create or update a question-bank template. */
export async function saveQuestionTemplate(
  _prev: QuestionState,
  formData: FormData
): Promise<QuestionState> {
  const { supabase } = await requirePlatformAdmin();

  const id = formData.get("id")?.toString() || null;
  const label = (formData.get("label")?.toString() ?? "").trim();
  const fieldType = (formData.get("fieldType")?.toString() ?? "short_text").trim();
  const category = (formData.get("category")?.toString() ?? "General").trim() || "General";
  const helpText = (formData.get("helpText")?.toString() ?? "").trim() || null;
  const options = CHOICE.includes(fieldType)
    ? (formData.get("options")?.toString() ?? "")
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (!label) return { error: "Enter the question." };
  if (CHOICE.includes(fieldType) && options.length === 0) {
    return { error: "Add at least one option for this question type." };
  }

  const row = { label, field_type: fieldType, options, help_text: helpText, category };
  const { error } = id
    ? await supabase.from("question_templates").update(row).eq("id", id)
    : await supabase.from("question_templates").insert(row);

  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/founder/questions");
  return { ok: true };
}

export async function deleteQuestionTemplate(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  await supabase.from("question_templates").delete().eq("id", id);
  revalidatePath("/founder/questions");
}
