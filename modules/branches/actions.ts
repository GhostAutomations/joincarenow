"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";

export type BranchState = { error?: string; ok?: boolean } | undefined;

export async function createBranch(
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the branch a name" };

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("branches")
    .insert({ company_id: current.company_id, name });

  if (error) {
    if (error.code === "23505") return { error: "A branch with that name already exists" };
    return { error: "Could not add the branch." };
  }
  revalidatePath("/settings");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteBranch(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  await supabase.from("branches").delete().eq("id", id).eq("company_id", current.company_id);
  revalidatePath("/settings");
  revalidatePath("/jobs");
}
