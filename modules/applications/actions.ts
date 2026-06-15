"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STAGES = [
  "applied",
  "reviewing",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;
type Stage = (typeof STAGES)[number];

export type ChangeStageResult = { error?: string; ok?: boolean };

/** Move an application to a new stage. RLS ensures only members of the
 *  application's company can update it; we also write an audit entry. */
export async function changeStage(
  applicationId: string,
  stage: string
): Promise<ChangeStageResult> {
  if (!STAGES.includes(stage as Stage)) return { error: "Invalid stage" };

  const supabase = await createClient();

  // Read current row (RLS-scoped) to capture before-state + company id.
  const { data: before } = await supabase
    .from("applications")
    .select("id, company_id, stage")
    .eq("id", applicationId)
    .single();

  if (!before) return { error: "Application not found" };
  if (before.stage === stage) return { ok: true };

  const { error } = await supabase
    .from("applications")
    .update({ stage })
    .eq("id", applicationId);

  if (error) return { error: "Could not update stage. Please try again." };

  await supabase.rpc("log_audit", {
    p_company_id: before.company_id,
    p_action: "application.stage_changed",
    p_entity_type: "application",
    p_entity_id: applicationId,
    p_before: { stage: before.stage },
    p_after: { stage },
  });

  // Hiring kicks off onboarding (idempotent — only creates tasks once).
  if (stage === "hired") {
    await supabase.rpc("start_onboarding", { p_application_id: applicationId });
  }

  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  revalidatePath("/applicants");
  return { ok: true };
}

/** Mint a short-lived signed URL for an application's CV. Permission is
 *  enforced by reading the application through the caller's RLS-scoped client
 *  first; only then do we use the admin client to sign the private object. */
export async function getCvUrl(
  applicationId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id, cv_path")
    .eq("id", applicationId)
    .single();

  if (!app) return { error: "Not found or no access" };
  if (!app.cv_path) return { error: "No CV was uploaded for this application" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("applications")
    .createSignedUrl(app.cv_path, 120); // valid for 2 minutes

  if (error || !data) return { error: "Could not open the CV. Please try again." };
  return { url: data.signedUrl };
}
