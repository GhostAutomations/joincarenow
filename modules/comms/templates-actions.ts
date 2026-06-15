"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";

export type TemplateState = { error?: string; ok?: boolean } | undefined;

export async function saveTemplate(
  _prev: TemplateState,
  formData: FormData
): Promise<TemplateState> {
  const id = formData.get("id")?.toString() || null;
  const channel = formData.get("channel")?.toString() ?? "email";
  if (!["email", "sms"].includes(channel)) return { error: "Invalid channel" };
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the template a name" };
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!body) return { error: "The message body can't be empty" };
  const subject =
    channel === "email" ? (formData.get("subject")?.toString() ?? "").trim() || null : null;
  if (channel === "email" && !subject) return { error: "Email templates need a subject" };
  const category = formData.get("category")?.toString()?.trim() || null;

  const { supabase, current } = await requireCompany();
  const row = {
    company_id: current.company_id,
    channel,
    name,
    subject,
    body,
    category,
  };

  const { error } = id
    ? await supabase.from("message_templates").update(row).eq("id", id).eq("company_id", current.company_id)
    : await supabase.from("message_templates").insert(row);

  if (error) return { error: "Could not save the template." };
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  await supabase.from("message_templates").delete().eq("id", id).eq("company_id", current.company_id);
  revalidatePath("/templates");
}
