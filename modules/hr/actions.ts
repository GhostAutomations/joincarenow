"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type HrState = { error?: string; ok?: boolean } | undefined;

const ABSENCE_TYPES = ["sickness", "holiday", "unauthorised", "other"];
const WARNING_LEVELS = ["verbal", "written", "final"];

function revalidateEmployee(id: string) {
  revalidatePath(`/employees/${id}`);
}

// ---------- Absences ----------
export async function addAbsence(_prev: HrState, formData: FormData): Promise<HrState> {
  const employeeId = formData.get("employeeId")?.toString();
  if (!employeeId) return { error: "Missing employee" };
  const absenceType = formData.get("absenceType")?.toString() ?? "sickness";
  if (!ABSENCE_TYPES.includes(absenceType)) return { error: "Pick an absence type" };
  const startDate = formData.get("startDate")?.toString();
  if (!startDate) return { error: "Start date is required" };
  const endDate = formData.get("endDate")?.toString() || null;
  const daysRaw = formData.get("days")?.toString();
  const days = daysRaw ? Number(daysRaw) : null;
  const reason = formData.get("reason")?.toString()?.trim() || null;

  const { supabase, user, current } = await requireCompany();
  const { error } = await supabase.from("employee_absences").insert({
    company_id: current.company_id,
    employee_id: employeeId,
    absence_type: absenceType,
    start_date: startDate,
    end_date: endDate,
    days: days != null && !Number.isNaN(days) ? days : null,
    reason,
    created_by: user.id,
  });
  if (error) return { error: "Could not log the absence." };
  revalidateEmployee(employeeId);
  return { ok: true };
}

export async function deleteAbsence(formData: FormData) {
  const id = formData.get("id")?.toString();
  const employeeId = formData.get("employeeId")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  await supabase.from("employee_absences").delete().eq("id", id).eq("company_id", current.company_id);
  if (employeeId) revalidateEmployee(employeeId);
}

// ---------- Warnings ----------
export async function addWarning(_prev: HrState, formData: FormData): Promise<HrState> {
  const employeeId = formData.get("employeeId")?.toString();
  if (!employeeId) return { error: "Missing employee" };
  const level = formData.get("level")?.toString() ?? "verbal";
  if (!WARNING_LEVELS.includes(level)) return { error: "Pick a warning level" };
  const title = formData.get("title")?.toString()?.trim();
  if (!title) return { error: "Give the warning a title" };
  const note = formData.get("note")?.toString()?.trim() || null;
  const issuedDate = formData.get("issuedDate")?.toString() || null;
  const reviewDate = formData.get("reviewDate")?.toString() || null;

  const { supabase, user, current } = await requireCompany();
  const { error } = await supabase.from("employee_warnings").insert({
    company_id: current.company_id,
    employee_id: employeeId,
    level,
    title,
    note,
    issued_date: issuedDate || undefined,
    review_date: reviewDate,
    created_by: user.id,
  });
  if (error) return { error: "Could not record the warning." };
  revalidateEmployee(employeeId);
  return { ok: true };
}

export async function deleteWarning(formData: FormData) {
  const id = formData.get("id")?.toString();
  const employeeId = formData.get("employeeId")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  await supabase.from("employee_warnings").delete().eq("id", id).eq("company_id", current.company_id);
  if (employeeId) revalidateEmployee(employeeId);
}

// ---------- Documents ----------
export async function uploadHrDocument(_prev: HrState, formData: FormData): Promise<HrState> {
  const employeeId = formData.get("employeeId")?.toString();
  if (!employeeId) return { error: "Missing employee" };
  const title = formData.get("title")?.toString()?.trim();
  if (!title) return { error: "Give the document a name" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > 10 * 1024 * 1024) return { error: "File must be 10MB or smaller" };

  const docType = formData.get("docType")?.toString()?.trim() || null;
  const issuedDate = formData.get("issuedDate")?.toString() || null;
  const expiryDate = formData.get("expiryDate")?.toString() || null;
  const note = formData.get("note")?.toString()?.trim() || null;

  const { supabase, user, current } = await requireCompany();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${current.company_id}/${employeeId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from("hr-documents")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { error: "Could not upload. Please try again." };

  const { error } = await supabase.from("employee_documents").insert({
    company_id: current.company_id,
    employee_id: employeeId,
    doc_type: docType,
    title,
    file_path: path,
    issued_date: issuedDate,
    expiry_date: expiryDate,
    note,
    created_by: user.id,
  });
  if (error) return { error: "Uploaded, but could not save the record." };

  revalidateEmployee(employeeId);
  return { ok: true };
}

export async function deleteHrDocument(formData: FormData) {
  const id = formData.get("id")?.toString();
  const employeeId = formData.get("employeeId")?.toString();
  if (!id) return;
  const { supabase, current } = await requireCompany();
  const { data: doc } = await supabase
    .from("employee_documents")
    .select("file_path")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .maybeSingle();
  if (doc?.file_path) {
    await supabase.storage.from("hr-documents").remove([doc.file_path]);
  }
  await supabase.from("employee_documents").delete().eq("id", id).eq("company_id", current.company_id);
  if (employeeId) revalidateEmployee(employeeId);
}

/** Short-lived signed URL for an HR document, after an RLS permission check. */
export async function getHrDocUrl(docId: string): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireCompany();
  const { data: doc } = await supabase
    .from("employee_documents")
    .select("file_path")
    .eq("id", docId)
    .maybeSingle();
  if (!doc?.file_path) return { error: "Document not found" };
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("hr-documents").createSignedUrl(doc.file_path, 120);
  if (error || !data) return { error: "Could not open the document" };
  return { url: data.signedUrl };
}
