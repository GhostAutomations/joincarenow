"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";

export type RoleState = { error?: string; ok?: boolean } | undefined;

export async function createRole(
  _prev: RoleState,
  formData: FormData
): Promise<RoleState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the role a name" };

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("roles")
    .insert({ company_id: current.company_id, name });

  if (error) {
    if (error.code === "23505") return { error: "A role with that name already exists" };
    return { error: "Could not add the role." };
  }
  revalidatePath("/settings");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteRole(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  await supabase.from("roles").delete().eq("id", id).eq("company_id", current.company_id);
  revalidatePath("/settings");
  revalidatePath("/jobs");
}
