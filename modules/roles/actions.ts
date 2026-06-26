"use server";

import { revalidatePath } from "next/cache";
import { settingsContext, requireUser } from "@/modules/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RoleState = { error?: string; ok?: boolean } | undefined;

export async function createRole(
  _prev: RoleState,
  formData: FormData
): Promise<RoleState> {
  const name = (formData.get("name")?.toString() ?? "").trim();
  if (name.length < 2) return { error: "Give the role a name" };
  const team = formData.get("team") === "office" ? "office" : "care";

  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };

  // Append to the end of the current order within this team.
  const { data: last } = await db
    .from("roles")
    .select("position")
    .eq("company_id", companyId)
    .eq("team", team)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position: number } | null)?.position ?? -1) + 1;

  const { error } = await db.from("roles").insert({ company_id: companyId, name, team, position });

  if (error) {
    if (error.code === "23505") return { error: "A role with that name already exists" };
    return { error: "Could not add the role." };
  }
  revalidatePath("/settings");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Persist a drag-reordered role list. Founder (service-role) or company admin
 *  (RLS — roles_update requires is_company_admin). */
export async function reorderRoles(
  companyId: string,
  orderedIds: string[]
): Promise<{ ok: boolean }> {
  if (!companyId || !Array.isArray(orderedIds) || orderedIds.length === 0) return { ok: false };
  const { profile } = await requireUser();
  const db = profile?.is_platform_admin ? createAdminClient() : await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.from("roles").update({ position: i }).eq("id", orderedIds[i]).eq("company_id", companyId);
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
