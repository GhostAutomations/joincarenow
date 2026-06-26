"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedCompanyStarter, type SeedResult } from "@/lib/setup/seed";

export type SetupState = (SeedResult & { applied?: boolean }) | undefined;

/** Founder: tick a setup-wizard task that has no single "save" (the add-list
 *  sections — branches, roles, workflows). Records settings.setup_checked[key]. */
export async function finaliseSetupTask(companyId: string, key: string): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  if (!companyId || !key) return { ok: false };
  const db = createAdminClient();
  const { data: co } = await db.from("companies").select("settings").eq("id", companyId).single();
  const settings = (co?.settings ?? {}) as Record<string, unknown>;
  const checked = { ...((settings.setup_checked as Record<string, boolean>) ?? {}), [key]: true };
  await db.from("companies").update({ settings: { ...settings, setup_checked: checked } }).eq("id", companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
}

/** Founder-only: apply the full starter pack to a company on demand.
 *  Idempotent — no-ops if the company has already been seeded. */
export async function applyStarterPack(
  _prev: SetupState,
  formData: FormData
): Promise<SetupState> {
  await requirePlatformAdmin();
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || !companyId) {
    return { ok: false, error: "Missing company." };
  }
  const result = await seedCompanyStarter(companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ...result, applied: result.ok };
}
