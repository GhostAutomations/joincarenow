"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type RetentionState = { ok?: boolean; error?: string } | undefined;

/** Save this company's data-retention periods (Settings → Data & Privacy). */
export async function setRetentionSettings(
  _prev: RetentionState,
  formData: FormData
): Promise<RetentionState> {
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only company admins can change retention." };

  const int = (v: FormDataEntryValue | null, min: number, max: number, dflt: number) => {
    const n = parseInt((v?.toString() ?? "").trim(), 10);
    if (Number.isNaN(n)) return dflt;
    return Math.min(max, Math.max(min, n));
  };

  const retention = {
    unsuccessful: {
      enabled: formData.get("unsuccessfulEnabled") === "on",
      months: int(formData.get("unsuccessfulMonths"), 1, 120, 6),
    },
    leavers: {
      enabled: formData.get("leaversEnabled") === "on",
      years: int(formData.get("leaversYears"), 1, 25, 6),
    },
  };

  const { data: row } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", current.company_id)
    .single();
  const settings = { ...((row?.settings as Record<string, unknown>) ?? {}), retention };
  const { error } = await supabase.from("companies").update({ settings }).eq("id", current.company_id);
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

// ============================================================
// Data & Privacy — SAR export + right-to-be-forgotten erasure
// ------------------------------------------------------------
// A company (the data controller) uses these to fulfil a candidate/employee
// Subject Access Request or erasure request. JCN is the processor: every read
// and delete is scoped to the caller's company, so one controller never sees or
// erases another controller's data about the same (shared) applicant.
// ============================================================

export type SarFile = { filename: string; url: string };
export type SarExport = {
  exportedAt: string;
  company: string;
  subject: Record<string, unknown>;
  applications: unknown[];
  forms: unknown[];
  communications: unknown[];
  interviews: unknown[];
  offers: unknown[];
  signedDocuments: unknown[];
  onboardingTasks: unknown[];
  references: unknown[];
  employee: unknown | null;
};

function ext(path: string, fallback = "bin"): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : fallback;
}
function safe(s: string): string {
  return (s || "file").replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Assemble everything this company holds about an applicant, for a Subject
 *  Access Request. Returns portable structured data + short-lived file URLs. */
export async function exportApplicantData(
  applicantId: string
): Promise<{ error?: string; data?: SarExport; files?: SarFile[] }> {
  const { supabase, current } = await requireCompany();
  const companyId = current.company_id;
  const admin = createAdminClient();

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, first_name, last_name, email, phone, created_at")
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant) return { error: "Applicant not found." };

  const { data: apps } = await supabase
    .from("applications")
    .select("id, stage, cover_message, answers, created_at, start_date, jobs(title)")
    .eq("company_id", companyId)
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });
  if (!apps || apps.length === 0) return { error: "No data for this applicant at your company." };
  const appIds = apps.map((a) => a.id as string);

  // Audit the export (accountability).
  await supabase.rpc("log_audit", {
    p_company_id: companyId,
    p_action: "data_privacy.applicant_exported",
    p_entity_type: "applicant",
    p_entity_id: applicantId,
    p_after: { applications: appIds.length },
  });

  // Forms (labelled Q&A).
  const forms: unknown[] = [];
  const { data: subs } = await supabase
    .from("form_submissions")
    .select("form_id, answers, created_at, forms(name)")
    .in("application_id", appIds)
    .eq("company_id", companyId);
  const formIds = Array.from(new Set((subs ?? []).map((s) => s.form_id as string).filter(Boolean)));
  const labelByField = new Map<string, string>();
  if (formIds.length) {
    const { data: fields } = await supabase.from("form_fields").select("id, label").in("form_id", formIds);
    for (const f of fields ?? []) labelByField.set(f.id as string, (f.label as string) ?? "Field");
  }
  for (const s of subs ?? []) {
    const answers = (s.answers as Record<string, string | string[]>) ?? {};
    forms.push({
      form: (s.forms as unknown as { name?: string })?.name ?? "Form",
      submittedAt: s.created_at,
      answers: Object.entries(answers).map(([k, v]) => ({
        question: labelByField.get(k) ?? k,
        answer: Array.isArray(v) ? v.join(", ") : String(v ?? ""),
      })),
    });
  }

  // Communications (emails + SMS with the candidate; excludes internal notes).
  const { data: msgs } = await supabase
    .from("messages")
    .select("channel, direction, subject, body, status, created_at")
    .eq("company_id", companyId)
    .eq("applicant_id", applicantId)
    .in("channel", ["email", "sms"])
    .order("created_at", { ascending: true });

  const { data: interviews } = await supabase
    .from("interviews")
    .select("scheduled_at, status, location, created_at")
    .in("application_id", appIds);
  const { data: offers } = await supabase
    .from("offers")
    .select("start_date, role, pay, hours, conditional, conditions, status, created_at")
    .in("application_id", appIds);
  const { data: signed } = await supabase
    .from("signed_documents")
    .select("title, doc_type, signer_name, signed_at, version, review_status")
    .eq("company_id", companyId)
    .eq("applicant_id", applicantId);
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("title, task_type, status, due_date, created_at")
    .in("application_id", appIds);
  const { data: references } = await supabase
    .from("reference_requests")
    .select("referee_name, referee_email, status, created_at")
    .in("application_id", appIds);
  const { data: employee } = await supabase
    .from("employees")
    .select("employee_ref, job_title, department, start_date, status, created_at")
    .eq("company_id", companyId)
    .eq("applicant_id", applicantId)
    .maybeSingle();

  // Files (short-lived signed URLs).
  const files: SarFile[] = [];
  async function addFile(bucket: string, path: string | null | undefined, label: string) {
    if (!path) return;
    try {
      const { data } = await admin.storage.from(bucket).createSignedUrl(path, 600);
      if (data?.signedUrl) files.push({ filename: `${safe(label)}.${ext(path)}`, url: data.signedUrl });
    } catch {
      /* skip unreadable */
    }
  }
  const { data: fileApps } = await supabase
    .from("applications")
    .select("cv_path, rtw_doc_path")
    .in("id", appIds);
  for (const a of fileApps ?? []) {
    await addFile("applications", a.cv_path as string, "CV");
    await addFile("applications", a.rtw_doc_path as string, "Right to Work");
  }
  const { data: docTasks } = await supabase
    .from("onboarding_tasks")
    .select("title, doc_path, doc_path_back")
    .in("application_id", appIds)
    .eq("task_type", "document");
  for (const t of docTasks ?? []) {
    await addFile("applications", t.doc_path as string, (t.title as string) || "Document");
    await addFile("applications", t.doc_path_back as string, `${(t.title as string) || "Document"} (back)`);
  }
  if (employee) {
    const { data: hr } = await supabase
      .from("employee_documents")
      .select("title, file_path, employees!inner(applicant_id, company_id)")
      .eq("employees.company_id", companyId)
      .eq("employees.applicant_id", applicantId);
    for (const d of hr ?? []) await addFile("hr-documents", d.file_path as string, (d.title as string) || "HR document");
  }

  const data: SarExport = {
    exportedAt: new Date().toISOString(),
    company: current.companies.name,
    subject: applicant as Record<string, unknown>,
    applications: apps,
    forms,
    communications: msgs ?? [],
    interviews: interviews ?? [],
    offers: offers ?? [],
    signedDocuments: signed ?? [],
    onboardingTasks: tasks ?? [],
    references: references ?? [],
    employee: employee ?? null,
  };
  return { data, files };
}

/** Permanently erase everything this company holds about an applicant (right to
 *  be forgotten). Hard delete — irreversible. Admin only. */
export async function eraseApplicant(
  applicantId: string
): Promise<{ ok?: boolean; error?: string; orphaned?: boolean }> {
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only company admins can erase data." };

  const { data, error } = await supabase.rpc("erase_applicant_at_company", {
    p_company_id: current.company_id,
    p_applicant_id: applicantId,
  });
  if (error) return { error: error.message || "Could not erase this applicant." };

  const result = (data ?? {}) as {
    storage_applications?: string[];
    storage_hr?: string[];
    user_id?: string | null;
    orphaned?: boolean;
  };

  const admin = createAdminClient();
  const appPaths = (result.storage_applications ?? []).filter(Boolean);
  const hrPaths = (result.storage_hr ?? []).filter(Boolean);
  if (appPaths.length) await admin.storage.from("applications").remove(appPaths).catch(() => {});
  if (hrPaths.length) await admin.storage.from("hr-documents").remove(hrPaths).catch(() => {});

  // Fully orphaned self-registered applicant: remove their login too.
  if (result.orphaned && result.user_id) {
    try {
      await admin.auth.admin.deleteUser(result.user_id);
    } catch {
      /* profile is already gone; a lingering auth row has no data access */
    }
  }

  revalidatePath("/applicants");
  revalidatePath("/pipeline");
  revalidatePath("/employees");
  return { ok: true, orphaned: result.orphaned };
}
