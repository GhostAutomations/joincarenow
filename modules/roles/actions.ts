"use server";

import { revalidatePath } from "next/cache";
import { settingsContext } from "@/modules/auth/queries";

export type RoleState = { error?: string; ok?: boolean } | undefined;

export async function createRole(
  _prev: RoleState,
  formData: FormData
): Promise<RoleState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the role a name" };

  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { error } = await db.from("roles").insert({ company_id: companyId, name });

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
  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return;
  await db.from("roles").delete().eq("id", id).eq("company_id", companyId);
  revalidatePath("/settings");
  revalidatePath("/jobs");
}
