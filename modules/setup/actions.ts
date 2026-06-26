"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { seedCompanyStarter, type SeedResult } from "@/lib/setup/seed";

export type SetupState = (SeedResult & { applied?: boolean }) | undefined;

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
