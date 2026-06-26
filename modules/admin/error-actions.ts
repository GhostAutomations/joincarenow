"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

/** Dismiss a single logged error. */
export async function dismissError(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const db = createAdminClient();
  await db.from("error_logs").delete().eq("id", id);
  revalidatePath("/founder/errors");
  revalidatePath("/founder");
}

/** Clear all logged errors (optionally just one source). */
export async function clearErrors(formData: FormData): Promise<void> {
  await requirePlatformAdmin();
  const source = formData.get("source")?.toString();
  const db = createAdminClient();
  let q = db.from("error_logs").delete();
  q = source ? q.eq("source", source) : q.not("id", "is", null);
  await q;
  revalidatePath("/founder/errors");
  revalidatePath("/founder");
}
