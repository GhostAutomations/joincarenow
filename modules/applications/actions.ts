"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncEmployeeToCarerAcademy } from "@/lib/integrations/carer-academy";
import { fileSignedDocumentsForEmployee } from "@/lib/documents/file-signed-docs";
import { notifyApplicant } from "@/modules/comms/actions";
import { requireCompany } from "@/modules/auth/queries";

const BASE_URL = "https://www.joincarenow.com";

/** Remove an applicant from this company's Talent Pool — deletes all their
 *  applications (and cascading records) at this company. The shared applicant
 *  profile is untouched, so they can still apply again. */
export async function removeFromTalentPool(
  applicantId: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!applicantId) return { error: "Missing applicant" };
  const { supabase, current } = await requireCompany();
  const { error } = await supabase.rpc("remove_applicant_from_pool", {
    p_company_id: current.company_id,
    p_applicant_id: applicantId,
  });
  if (error) return { error: "Could not remove this applicant. Please try again." };
  revalidatePath("/applicants");
  revalidatePath("/pipeline");
  return { ok: true };
}

/** Move an applicant to Not Progressing and send them a rejection reply. The
 *  email can include a talent-pool opt-in link. Message supports merge fields. */
export async function sendRejection(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const applicationId = formData.get("applicationId")?.toString();
  const message = formData.get("message")?.toString().trim() ?? "";
  const channel = (formData.get("channel")?.toString() ?? "both") as "email" | "sms" | "both";
  const talentPool = formData.get("talentPool") === "on";
  if (!applicationId) return { error: "Missing application" };
  if (message.length < 2) return { error: "Add a short message before sending." };

  const supabase = await createClient();
  const token = talentPool ? crypto.randomUUID() : null;

  const { error } = await supabase
    .from("applications")
    .update({ stage: "rejected", ...(token ? { talent_pool_token: token } : {}) })
    .eq("id", applicationId);
  if (error) return { error: "Could not update the applicant. Please try again." };

  const emailBody =
    talentPool && token
      ? `${message}\n\nWe'd love to keep your details for future roles. If you're happy for us to, use the button below to join our talent pool (you can ask to be removed any time).`
      : message;
  const talentCta =
    talentPool && token
      ? { label: "Join our talent pool", url: `${BASE_URL}/talent-pool/${token}` }
      : undefined;

  if (channel === "email" || channel === "both") {
    await notifyApplicant({ applicationId, channel: "email", subject: "Update on your application", body: emailBody, cta: talentCta });
  }
  if (channel === "sms" || channel === "both") {
    await notifyApplicant({ applicationId, channel: "sms", subject: "Update on your application", body: message });
  }

  revalidatePath("/pipeline");
  return { ok: true };
}

export type RejectionTemplate = { id: string; name: string; body: string };

/** Company's saved Not-progressing reasons (name + message) for the popup. */
export async function getRejectionTemplates(): Promise<RejectionTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rejection_templates")
    .select("id, name, body")
    .order("created_at", { ascending: true });
  return (data ?? []) as RejectionTemplate[];
}

/** Save a new Not-progressing reason so it appears in the dropdown next time. */
export async function saveRejectionTemplate(
  name: string,
  body: string
): Promise<{ template?: RejectionTemplate; error?: string }> {
  const trimmedName = name.trim();
  const trimmedBody = body.trim();
  if (trimmedName.length < 2) return { error: "Give the reason a short name." };
  if (trimmedBody.length < 2) return { error: "The message is empty." };

  const { supabase, current } = await requireCompany();
  const { data, error } = await supabase
    .from("rejection_templates")
    .insert({ company_id: current.company_id, name: trimmedName, body: trimmedBody })
    .select("id, name, body")
    .single();
  if (error || !data) return { error: "Could not save the reason. Please try again." };
  return { template: data as RejectionTemplate };
}

export type TalentPoolInvite = { companyName: string; firstName: string | null; opted: boolean };

/** Public (no login): details for the talent-pool opt-in page. */
export async function getTalentPoolInvite(token: string): Promise<TalentPoolInvite | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_talent_pool_invite", { p_token: token });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return null;
  return {
    companyName: (row.company_name as string) ?? "The team",
    firstName: (row.first_name as string) ?? null,
    opted: !!row.opted,
  };
}

/** Public (no login): record talent-pool consent via the rejection link token. */
export async function consentTalentPool(token: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("consent_talent_pool_by_token", { p_token: token });
  if (error) return { error: error.message || "Could not record your choice." };
  return { ok: true };
}

const STAGES = [
  "applied",
  "reviewing",
  "interview",
  "right_to_work",
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
  if (["reviewing", "interview", "right_to_work", "offer", "hired"].includes(stage)) {
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

    // Seal the approved signed contracts/policies into the new employee's
    // Documents (idempotent). Never block the hire on a filing error.
    if (typeof employeeId === "string") {
      try {
        await fileSignedDocumentsForEmployee(supabase, {
          companyId: before.company_id,
          employeeId,
          applicationId,
          createdBy: auth.user?.id ?? null,
        });
      } catch {
        /* filing is best-effort; the staff-file ZIP still renders signatures live */
      }
    }
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
  is_cv?: boolean;
  doc_kind?: string | null;
};

/** Workflow items for an application, used by the pre-Hire confirmation.
 *  "Outstanding" = required tasks not yet approved. RLS scopes to the company. */
export async function getHireChecklist(
  applicationId: string
): Promise<{ items: HireChecklistItem[] }> {
  const supabase = await createClient();
  const [{ data: tasks }, { data: refs }, { data: app }] = await Promise.all([
    supabase
      .from("onboarding_tasks")
      .select("id, title, task_type, required, status, is_cv, doc_kind")
      .eq("application_id", applicationId)
      .order("position"),
    supabase
      .from("reference_requests")
      .select("id, referee_name, status")
      .eq("application_id", applicationId)
      .order("created_at"),
    supabase
      .from("applications")
      .select("rtw_verified_at")
      .eq("id", applicationId)
      .single(),
  ]);

  // Right to Work joins the checklist too.
  const rtwItem: HireChecklistItem = {
    id: "rtw",
    title: "Right to work verified",
    task_type: "right_to_work",
    required: true,
    status: (app as { rtw_verified_at?: string } | null)?.rtw_verified_at ? "approved" : "pending",
  };

  // References join the same checklist: only an approved reference counts as done.
  const refItems: HireChecklistItem[] = (refs ?? []).map((r) => ({
    id: `ref-${r.id as string}`,
    title: `Reference: ${r.referee_name as string}`,
    task_type: "reference",
    required: true,
    status: (r.status as string) === "approved" ? "approved" : "pending",
  }));

  return { items: [...((tasks ?? []) as HireChecklistItem[]), rtwItem, ...refItems] };
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

/** Recruiter: record a verified Right to Work — uploads the document, share code
 *  and expiry, with a declaration that the original was checked and is a true
 *  likeness. */
export async function verifyRightToWork(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const applicationId = formData.get("applicationId")?.toString();
  const shareCode = formData.get("shareCode")?.toString().trim() || null;
  const expiry = formData.get("expiry")?.toString() || null;
  const declared = formData.get("declaration") === "on";
  const file = formData.get("doc");
  if (!applicationId) return { error: "Missing application" };
  if (!declared) return { error: "Please confirm you have checked the document" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("applications")
    .select("id, company_id")
    .eq("id", applicationId)
    .single();
  if (!before) return { error: "Application not found" };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  // Optional document upload (private bucket).
  let docPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { error: "File must be 10MB or smaller" };
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    docPath = `${before.company_id}/rtw/${applicationId}-${Date.now()}-${safe}`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from("applications")
      .upload(docPath, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return { error: "Could not upload the document. Please try again." };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      ...(docPath ? { rtw_doc_path: docPath } : {}),
      rtw_share_code: shareCode,
      rtw_expiry: expiry,
      rtw_verified_by: userId,
      rtw_verified_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (error) return { error: "Could not save. Please try again." };

  await supabase.rpc("log_audit", {
    p_company_id: before.company_id,
    p_action: "application.rtw_verified",
    p_entity_type: "application",
    p_entity_id: applicationId,
    p_before: {},
    p_after: { share_code: shareCode, expiry, declared: true },
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

/** Signed URL for an application's uploaded Right to Work document. */
export async function getRtwDocUrl(
  applicationId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, rtw_doc_path")
    .eq("id", applicationId)
    .single();
  if (!app?.rtw_doc_path) return { error: "No document uploaded" };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("applications")
    .createSignedUrl(app.rtw_doc_path as string, 120);
  if (error || !data) return { error: "Could not open the document." };
  return { url: data.signedUrl };
}
