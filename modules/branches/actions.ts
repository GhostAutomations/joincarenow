"use server";

import { revalidatePath } from "next/cache";
import { settingsContext } from "@/modules/auth/queries";

export type BranchState = { error?: string; ok?: boolean } | undefined;

export async function createBranch(
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the branch a name" };

  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { error } = await db.from("branches").insert({ company_id: companyId, name });

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
  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return;
  await db.from("branches").delete().eq("id", id).eq("company_id", companyId);
  revalidatePath("/settings");
  revalidatePath("/jobs");
}
