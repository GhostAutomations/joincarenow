"use server";

import { revalidatePath } from "next/cache";
import { settingsContext } from "@/modules/auth/queries";
import { syncExtraBranches } from "@/lib/billing/branches";

export type BranchState = { error?: string; ok?: boolean } | undefined;

/** Read the optional area/office address fields from the form. */
function addressFrom(formData: FormData) {
  const clean = (k: string) => {
    const v = (formData.get(k)?.toString() ?? "").trim();
    return v.length ? v : null;
  };
  return {
    address_line: clean("address_line"),
    city: clean("city"),
    region: clean("region"),
    postcode: clean("postcode"),
  };
}

export async function createBranch(
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the branch a name" };

  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { error } = await db
    .from("branches")
    .insert({ company_id: companyId, name, ...addressFrom(formData) });

  if (error) {
    if (error.code === "23505") return { error: "A branch with that name already exists" };
    return { error: "Could not add the branch." };
  }
  await syncExtraBranches(companyId);
  revalidatePath("/settings");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Edit a branch's name and/or its area address (used for job structured data). */
export async function updateBranch(
  _prev: BranchState,
  formData: FormData
): Promise<BranchState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing branch" };
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the branch a name" };

  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { error } = await db
    .from("branches")
    .update({ name, ...addressFrom(formData) })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    if (error.code === "23505") return { error: "A branch with that name already exists" };
    return { error: "Could not save the branch." };
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
  await syncExtraBranches(companyId);
  revalidatePath("/settings");
  revalidatePath("/jobs");
}
