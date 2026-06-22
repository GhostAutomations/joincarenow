"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/modules/auth/queries";
import { sendEmail } from "@/lib/comms/send";

const BASE_URL = "https://www.joincarenow.com";

export type ReferenceFieldView = {
  id: string;
  label: string;
  field_type: string;
  options: string[];
  config: { text?: string; size?: string; color?: string } | null;
};

export type ReferenceReview = {
  id: string;
  refereeName: string;
  refereeEmail: string;
  status: string;
  fields: ReferenceFieldView[];
  answers: Record<string, string | string[]>;
};

/** Staff: add a referee for an applicant's application. */
export async function addReferee(formData: FormData) {
  const applicationId = formData.get("applicationId")?.toString();
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const employer = formData.get("employer")?.toString().trim() || null;
  const relationship = formData.get("relationship")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  if (!applicationId || !name || !email) return { error: "Name and email are required" };

  const { supabase, current } = await requireCompany();
  const { data: app } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .eq("company_id", current.company_id)
    .single();
  if (!app?.applicant_id) return { error: "Application not found" };

  const { data: formId } = await supabase.rpc("ensure_reference_form", {
    p_company_id: current.company_id,
  });

  const { error } = await supabase.from("reference_requests").insert({
    company_id: current.company_id,
    application_id: applicationId,
    applicant_id: app.applicant_id,
    referee_name: name,
    referee_email: email,
    referee_employer: employer,
    referee_phone: phone,
    relationship,
    form_id: (formId as string) ?? null,
    status: "pending",
  });
  if (error) return { error: "Could not add referee. Please try again." };
  revalidatePath("/referencing");
  return { ok: true };
}

/** Staff: email the referee a secure link and mark the request as sent. */
export async function sendReferenceRequest(id: string) {
  const { supabase, current } = await requireCompany();
  const { data: rr } = await supabase
    .from("reference_requests")
    .select(
      "id, token, referee_name, referee_email, status, applications(jobs(title)), applicants(first_name, last_name), companies(name)"
    )
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!rr) return { error: "Reference not found" };

  const link = `${BASE_URL}/reference/${rr.token}`;
  const applicant = rr.applicants as unknown as { first_name: string | null; last_name: string | null } | null;
  const company = rr.companies as unknown as { name: string } | null;
  const applicantName =
    [applicant?.first_name, applicant?.last_name].filter(Boolean).join(" ") || "an applicant";
  const companyName = company?.name || "our team";

  const res = await sendEmail({
    to: rr.referee_email as string,
    subject: `Reference request for ${applicantName}`,
    text:
      `Hello ${rr.referee_name},\n\n` +
      `${applicantName} has applied for a role with ${companyName} and has given your name as a referee. ` +
      `Please complete a short reference using the secure link below:\n\n${link}\n\n` +
      `It only takes a few minutes. Thank you for your help.\n\n${companyName}`,
  });
  if (!res.ok) return { error: res.error || "Could not send the email." };

  await supabase
    .from("reference_requests")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", current.company_id);

  await supabase.rpc("log_audit", {
    p_company_id: current.company_id,
    p_action: "reference.requested",
    p_entity_type: "reference",
    p_entity_id: id,
    p_before: {},
    p_after: { referee_email: rr.referee_email },
  });

  revalidatePath("/referencing");
  return { ok: true };
}

/** Staff: approve or reject (request changes to) a received reference. */
export async function reviewReference(formData: FormData) {
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  const note = formData.get("note")?.toString() || null;
  if (!id || (status !== "approved" && status !== "rejected")) return { error: "Invalid input" };

  const { supabase, user, current } = await requireCompany();
  await supabase
    .from("reference_requests")
    .update({
      status,
      review_note: note,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", current.company_id);
  revalidatePath("/referencing");
  return { ok: true };
}

export type ApplicationReference = {
  id: string;
  referee_name: string;
  referee_email: string;
  status: string;
};

/** Staff: list an application's referees + their statuses (for the pipeline panel). */
export async function getApplicationReferences(applicationId: string): Promise<ApplicationReference[]> {
  const { supabase, current } = await requireCompany();
  const { data } = await supabase
    .from("reference_requests")
    .select("id, referee_name, referee_email, status")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: true });
  return (data ?? []) as ApplicationReference[];
}

/** Staff: load a reference's questions + the referee's answers for review. */
export async function getReferenceReview(id: string): Promise<ReferenceReview | null> {
  const { supabase, current } = await requireCompany();
  const { data: rr } = await supabase
    .from("reference_requests")
    .select("id, referee_name, referee_email, status, form_id, answers")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!rr || !rr.form_id) return null;

  const { data: fields } = await supabase
    .from("form_fields")
    .select("id, label, field_type, options, config, position")
    .eq("form_id", rr.form_id)
    .order("position", { ascending: true });

  return {
    id: rr.id as string,
    refereeName: rr.referee_name as string,
    refereeEmail: rr.referee_email as string,
    status: rr.status as string,
    fields: (fields ?? []).map((f) => ({
      id: f.id as string,
      label: f.label as string,
      field_type: f.field_type as string,
      options: (f.options ?? []) as string[],
      config: (f.config ?? null) as ReferenceFieldView["config"],
    })),
    answers: (rr.answers as Record<string, string | string[]>) ?? {},
  };
}

/** Staff: delete a referee request. */
export async function deleteReference(id: string) {
  const { supabase, current } = await requireCompany();
  await supabase
    .from("reference_requests")
    .delete()
    .eq("id", id)
    .eq("company_id", current.company_id);
  revalidatePath("/referencing");
  return { ok: true };
}

// ---------- Applicant (portal) ----------
export async function addMyReferee(formData: FormData) {
  const applicationId = formData.get("applicationId")?.toString();
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const employer = formData.get("employer")?.toString().trim() || null;
  const relationship = formData.get("relationship")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  if (!applicationId || !name || !email) return { error: "Name and email are required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_my_referee", {
    p_application_id: applicationId,
    p_name: name,
    p_email: email,
    p_employer: employer,
    p_relationship: relationship,
    p_phone: phone,
  });
  if (error) return { error: error.message || "Could not add referee. Please try again." };
  revalidatePath("/portal");
  return { ok: true };
}

export async function deleteMyReferee(id: string) {
  const supabase = await createClient();
  await supabase.rpc("delete_my_referee", { p_id: id });
  revalidatePath("/portal");
  return { ok: true };
}

// ---------- Public (referee, no login) ----------
export async function submitReference(formData: FormData) {
  const token = formData.get("token")?.toString();
  if (!token) return { error: "Invalid link" };

  // Collect field_* answers (mirrors the apply/onboarding form encoding).
  const answers: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("field_")) continue;
    const id = key.slice("field_".length);
    const v = value.toString();
    if (answers[id] === undefined) answers[id] = v;
    else if (Array.isArray(answers[id])) (answers[id] as string[]).push(v);
    else answers[id] = [answers[id] as string, v];
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_reference_by_token", {
    p_token: token,
    p_answers: answers,
  });
  if (error) return { error: "Could not submit. Please try again." };
  return { ok: true };
}
