"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncEmployeeToCarerAcademy } from "@/lib/integrations/carer-academy";

export type EmployeeState = { error?: string; ok?: boolean } | undefined;

const STATUSES = ["active", "inactive", "left"] as const;

/** Update the editable fields of an employee's master record. */
export async function updateEmployee(
  _prev: EmployeeState,
  formData: FormData
): Promise<EmployeeState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing employee" };

  const status = formData.get("status")?.toString() ?? "active";
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { error: "Invalid status" };
  }
  const managerId = formData.get("managerId")?.toString() || null;
  const branchId = formData.get("branchId")?.toString() || null;

  const { supabase, current } = await requireCompany();

  // Snapshot the branch name so the breakdown is resilient to renames/deletes.
  let branchName: string | null = null;
  if (branchId) {
    const { data: b } = await supabase
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .eq("company_id", current.company_id)
      .maybeSingle();
    branchName = b?.name ?? null;
  }

  const { error } = await supabase
    .from("employees")
    .update({
      employee_ref: formData.get("employeeRef")?.toString()?.trim() || null,
      job_title: formData.get("jobTitle")?.toString()?.trim() || null,
      department: formData.get("department")?.toString()?.trim() || null,
      branch_id: branchId,
      branch: branchName,
      worker_category: formData.get("workerCategory")?.toString()?.trim() || null,
      training_group: formData.get("trainingGroup")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      start_date: formData.get("startDate")?.toString() || null,
      manager_id: managerId,
      status,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);

  if (error) {
    if (error.code === "23505") return { error: "That employee number is already in use." };
    return { error: "Could not save. Please try again." };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}

/** Delete an employee record (admin only). The recruitment history (application,
 *  signed documents) is retained — only the employee master record is removed, so
 *  re-hiring the same applicant creates a fresh record. */
export async function deleteEmployee(formData: FormData): Promise<void> {
  const id = formData.get("id")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return;
  await supabase.from("employees").delete().eq("id", id).eq("company_id", current.company_id);
  revalidatePath("/employees");
  redirect("/employees");
}

/** Manually (re)send an employee to Carer.Academy — for retries after a
 *  failure or to re-sync updated details. */
export async function resendToCarerAcademy(
  _prev: EmployeeState,
  formData: FormData
): Promise<EmployeeState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing employee" };

  // Confirm the employee belongs to the caller's company (RLS-safe).
  const { supabase, current } = await requireCompany();
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (!emp) return { error: "Employee not found." };

  const result = await syncEmployeeToCarerAcademy(id);

  revalidatePath(`/employees/${id}`);
  if (!result.ok) return { error: result.error ?? "Sync failed." };
  return { ok: true };
}

function extOf(path: string, fallback = "bin"): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : fallback;
}

function safeName(s: string): string {
  return (s || "document").replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Assemble the complete staff file for an employee: signed contracts/policies
 *  (text + signature), submitted forms (labelled Q&A) and signed URLs for every
 *  uploaded file (CV, Right to Work, requested documents like DBS, and HR docs).
 *  Read-access is RLS-scoped to the caller's company; file URLs are short-lived,
 *  admin-signed. Used by the one-click "Download staff file" (ZIP) on the
 *  employee record. */
export async function getStaffFile(employeeId: string): Promise<{
  error?: string;
  employeeRef?: string;
  fullName?: string;
  signedDocs?: {
    title: string; docType: string; signerName: string; signedAt: string;
    signatureMethod: string; signatureImage: string | null; body: string; version: number | null;
  }[];
  forms?: { name: string; submittedAt: string | null; fields: { label: string; value: string }[] }[];
  files?: { filename: string; url: string }[];
}> {
  const { supabase, current } = await requireCompany();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, company_id, applicant_id, application_id, employee_ref, first_name, last_name")
    .eq("id", employeeId)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (!emp) return { error: "Employee not found." };

  const fullName = [emp.first_name, emp.last_name].filter(Boolean).join(" ") || emp.employee_ref;
  const admin = createAdminClient();

  // --- Signed contracts + policies (immutable snapshots) ---
  const signedDocs: NonNullable<Awaited<ReturnType<typeof getStaffFile>>["signedDocs"]> = [];
  const sdCol = emp.applicant_id ? "applicant_id" : emp.application_id ? "application_id" : null;
  const sdVal = emp.applicant_id ?? emp.application_id;
  if (sdCol && sdVal) {
    const { data: sd } = await supabase
      .from("signed_documents")
      .select("title, doc_type, signer_name, signed_at, signature_method, signature_image, body_snapshot, version")
      .eq("company_id", current.company_id)
      .eq(sdCol, sdVal as string)
      .order("signed_at", { ascending: false });
    for (const r of sd ?? []) {
      signedDocs.push({
        title: r.title as string,
        docType: r.doc_type as string,
        signerName: r.signer_name as string,
        signedAt: r.signed_at as string,
        signatureMethod: r.signature_method as string,
        signatureImage: (r.signature_image as string) ?? null,
        body: r.body_snapshot as string,
        version: (r.version as number) ?? null,
      });
    }
  }

  // --- Submitted forms (labelled Q&A) ---
  const forms: NonNullable<Awaited<ReturnType<typeof getStaffFile>>["forms"]> = [];
  if (emp.application_id) {
    const { data: subs } = await supabase
      .from("form_submissions")
      .select("form_id, answers, created_at, forms(name)")
      .eq("application_id", emp.application_id)
      .eq("company_id", current.company_id)
      .order("created_at", { ascending: false });
    const formIds = Array.from(new Set((subs ?? []).map((s) => s.form_id as string).filter(Boolean)));
    const labelByField = new Map<string, { label: string; position: number }>();
    if (formIds.length) {
      const { data: fields } = await supabase
        .from("form_fields")
        .select("id, label, position")
        .in("form_id", formIds);
      for (const f of fields ?? []) {
        labelByField.set(f.id as string, { label: (f.label as string) ?? "Field", position: (f.position as number) ?? 0 });
      }
    }
    for (const s of subs ?? []) {
      const answers = (s.answers as Record<string, string | string[]>) ?? {};
      const rows = Object.entries(answers)
        .map(([fieldId, val]) => {
          const meta = labelByField.get(fieldId);
          const value = Array.isArray(val) ? val.join(", ") : String(val ?? "");
          return { label: meta?.label ?? fieldId, value, position: meta?.position ?? 9999 };
        })
        .sort((a, b) => a.position - b.position)
        .map(({ label, value }) => ({ label, value }));
      const f = s.forms as unknown as { name: string } | null;
      forms.push({ name: f?.name ?? "Form", submittedAt: (s.created_at as string) ?? null, fields: rows });
    }
  }

  // --- Uploaded files (signed URLs) ---
  const files: { filename: string; url: string }[] = [];
  async function addFile(bucket: string, path: string | null | undefined, label: string) {
    if (!path) return;
    try {
      const { data } = await admin.storage.from(bucket).createSignedUrl(path, 600);
      if (data?.signedUrl) files.push({ filename: `${safeName(label)}.${extOf(path)}`, url: data.signedUrl });
    } catch {
      /* skip unreadable files */
    }
  }

  if (emp.application_id) {
    const { data: app } = await supabase
      .from("applications")
      .select("cv_path, rtw_doc_path")
      .eq("id", emp.application_id)
      .maybeSingle();
    await addFile("applications", app?.cv_path as string | null, "CV");
    await addFile("applications", app?.rtw_doc_path as string | null, "Right to Work");

    const { data: docTasks } = await supabase
      .from("onboarding_tasks")
      .select("title, doc_path, is_cv")
      .eq("application_id", emp.application_id)
      .eq("task_type", "document")
      .not("doc_path", "is", null);
    for (const t of docTasks ?? []) {
      if (t.is_cv) continue; // CV already added from the application
      await addFile("applications", t.doc_path as string, (t.title as string) || "Document");
    }
  }

  const { data: hrDocs } = await supabase
    .from("employee_documents")
    .select("title, file_path")
    .eq("employee_id", employeeId);
  for (const d of hrDocs ?? []) {
    await addFile("hr-documents", d.file_path as string, (d.title as string) || "HR document");
  }

  return { employeeRef: emp.employee_ref as string, fullName, signedDocs, forms, files };
}
