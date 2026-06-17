"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncEmployeeToCarerAcademy } from "@/lib/integrations/carer-academy";

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
    .update({ stage, ...(stage === "hired" ? { hired_at: new Date().toISOString() } : {}) })
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

  // Fire any workflow tasks set to trigger at this stage (idempotent —
  // dedups by template, so re-entering a stage won't duplicate tasks).
  if (["reviewing", "interview", "offer", "hired"].includes(stage)) {
    await supabase.rpc("create_stage_tasks", {
      p_application_id: applicationId,
      p_trigger: stage,
    });
  }

  // Hiring creates the master employee record (idempotent — one per
  // hired application). This is the source of truth downstream systems read.
  if (stage === "hired") {
    const { data: employeeId, error: empErr } = await supabase.rpc(
      "create_employee_from_application",
      { p_application_id: applicationId }
    );
    if (empErr) {
      return { error: `Moved to Hired, but the employee record failed: ${empErr.message}` };
    }
    // Push the new employee to Carer.Academy (logs success/failure; the
    // recruiter can Resend from the employee record if it fails). Don't block
    // the hire on a sync error.
    if (typeof employeeId === "string") {
      await syncEmployeeToCarerAcademy(employeeId);
    }

    // Record WHO hired them (named) for the audit trail / reports.
    const { data: auth } = await supabase.auth.getUser();
    let hiredBy = "";
    if (auth.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", auth.user.id)
        .maybeSingle();
      hiredBy = prof?.full_name || prof?.email || "";
    }
    await supabase.rpc("log_audit", {
      p_company_id: before.company_id,
      p_action: "application.hired",
      p_entity_type: "application",
      p_entity_id: applicationId,
      p_before: {},
      p_after: { hired_by: hiredBy },
    });
  }

  revalidatePath("/pipeline");
  revalidatePath("/onboarding-board");
  revalidatePath("/applicants");
  revalidatePath("/employees");
  return { ok: true };
}

export type HireChecklistItem = {
  id: string;
  title: string;
  task_type: string;
  required: boolean;
  status: string;
};

/** Workflow items for an application, used by the pre-Hire confirmation.
 *  "Outstanding" = required tasks not yet approved. RLS scopes to the company. */
export async function getHireChecklist(
  applicationId: string
): Promise<{ items: HireChecklistItem[] }> {
  const supabase = await createClient();
  const [{ data: tasks }, { data: refs }] = await Promise.all([
    supabase
      .from("onboarding_tasks")
      .select("id, title, task_type, required, status")
      .eq("application_id", applicationId)
      .order("position"),
    supabase
      .from("reference_requests")
      .select("id, referee_name, status")
      .eq("application_id", applicationId)
      .order("created_at"),
  ]);

  // References join the same checklist: only an approved reference counts as done.
  const refItems: HireChecklistItem[] = (refs ?? []).map((r) => ({
    id: `ref-${r.id as string}`,
    title: `Reference: ${r.referee_name as string}`,
    task_type: "reference",
    required: true,
    status: (r.status as string) === "approved" ? "approved" : "pending",
  }));

  return { items: [...((tasks ?? []) as HireChecklistItem[]), ...refItems] };
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
