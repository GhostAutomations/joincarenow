"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/modules/auth/queries";
import { slugify } from "@/lib/utils";

const jobSchema = z.object({
  title: z.string().min(2, "Job title is required").max(150),
  description: z.string().max(20000).optional().or(z.literal("")),
  employment_type: z.string().max(60).optional().or(z.literal("")),
  branch_id: z.string().uuid().optional().or(z.literal("")),
  role_id: z.string().uuid().optional().or(z.literal("")),
  workflow_role_id: z.string().uuid().optional().or(z.literal("")),
  salary: z.string().max(100).optional().or(z.literal("")),
  vacancies: z.coerce.number().int().min(1).max(999).default(1),
  closing_date: z.string().optional().or(z.literal("")),
  application_form_id: z.string().uuid().optional().or(z.literal("")),
});

export type JobState = { error?: string } | undefined;

function parseJob(formData: FormData) {
  return jobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    employment_type: formData.get("employment_type") ?? "",
    branch_id: formData.get("branch_id") ?? "",
    role_id: formData.get("role_id") ?? "",
    workflow_role_id: formData.get("workflow_role_id") ?? "",
    salary: formData.get("salary") ?? "",
    vacancies: formData.get("vacancies") ?? 1,
    closing_date: formData.get("closing_date") ?? "",
    application_form_id: formData.get("application_form_id") ?? "",
  });
}

export async function createJob(
  _prev: JobState,
  formData: FormData
): Promise<JobState> {
  const parsed = parseJob(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { supabase, current } = await requireCompany();
  const baseSlug = slugify(parsed.data.title) || "role";

  let newId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        company_id: current.company_id,
        title: parsed.data.title,
        slug,
        description: parsed.data.description || null,
        employment_type: parsed.data.employment_type || null,
        branch_id: parsed.data.branch_id || null,
        role_id: parsed.data.role_id || null,
        workflow_role_id: parsed.data.workflow_role_id || null,
        salary: parsed.data.salary || null,
        vacancies: parsed.data.vacancies,
        closing_date: parsed.data.closing_date || null,
        application_form_id: parsed.data.application_form_id || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      newId = data.id;
      break;
    }
    if (error && !error.message.includes("duplicate key")) {
      return { error: "Could not create the job. Please try again." };
    }
  }

  if (!newId) return { error: "Could not generate a unique link for this job." };

  revalidatePath("/jobs");
  redirect(`/jobs/${newId}`);
}

export async function updateJob(
  _prev: JobState,
  formData: FormData
): Promise<JobState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Missing job id" };

  const parsed = parseJob(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("jobs")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      employment_type: parsed.data.employment_type || null,
      branch_id: parsed.data.branch_id || null,
      role_id: parsed.data.role_id || null,
      workflow_role_id: parsed.data.workflow_role_id || null,
      salary: parsed.data.salary || null,
      vacancies: parsed.data.vacancies,
      closing_date: parsed.data.closing_date || null,
      application_form_id: parsed.data.application_form_id || null,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);

  if (error) return { error: "Could not save changes. Please try again." };

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return undefined;
}

/** Publish / close / revert-to-draft. Used by small forms on the job page. */
export async function setJobStatus(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string") return;
  if (status !== "draft" && status !== "published" && status !== "closed") return;

  const { supabase, current } = await requireCompany();
  await supabase
    .from("jobs")
    .update({ status })
    .eq("id", id)
    .eq("company_id", current.company_id);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
}
