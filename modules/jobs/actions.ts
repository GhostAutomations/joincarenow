"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCompany } from "@/modules/auth/queries";
import { slugify, stripPound } from "@/lib/utils";

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
  contract_template_id: z.string().uuid().optional().or(z.literal("")),
  owner_id: z.string().uuid().optional().or(z.literal("")),
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
    contract_template_id: formData.get("contract_template_id") ?? "",
    owner_id: formData.get("owner_id") ?? "",
  });
}

/** Replace the job's assigned policies with the ticked set. */
async function syncJobPolicies(
  supabase: Awaited<ReturnType<typeof requireCompany>>["supabase"],
  jobId: string,
  policyIds: string[]
) {
  await supabase.from("job_policies").delete().eq("job_id", jobId);
  if (policyIds.length > 0) {
    await supabase
      .from("job_policies")
      .insert(policyIds.map((policy_id) => ({ job_id: jobId, policy_id })));
  }
}

export async function createJob(
  _prev: JobState,
  formData: FormData
): Promise<JobState> {
  const parsed = parseJob(formData);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { supabase, user, current } = await requireCompany();
  const baseSlug = slugify(parsed.data.title) || "role";
  // Default owner is the creator; an admin can pick someone else.
  const ownerId = parsed.data.owner_id || user.id;

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
        salary: stripPound(parsed.data.salary) || null,
        vacancies: parsed.data.vacancies,
        closing_date: parsed.data.closing_date || null,
        application_form_id: parsed.data.application_form_id || null,
        contract_template_id: parsed.data.contract_template_id || null,
        owner_id: ownerId,
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

  await syncJobPolicies(supabase, newId, formData.getAll("policy_ids").map(String));

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

  // Capture the previous owner (audit transfers) and contract (so a form that no
  // longer manages contracts/policies doesn't wipe what's already set).
  const { data: before } = await supabase
    .from("jobs")
    .select("owner_id, contract_template_id")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .maybeSingle();
  const newOwner = parsed.data.owner_id || (before?.owner_id as string | null) || null;
  // Contracts and policies now live on the workflow, so the job builder no longer
  // submits them. When the field is absent, keep the existing value.
  const newContract = formData.has("contract_template_id")
    ? parsed.data.contract_template_id || null
    : ((before?.contract_template_id as string | null) ?? null);

  const { error } = await supabase
    .from("jobs")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      employment_type: parsed.data.employment_type || null,
      branch_id: parsed.data.branch_id || null,
      role_id: parsed.data.role_id || null,
      workflow_role_id: parsed.data.workflow_role_id || null,
      salary: stripPound(parsed.data.salary) || null,
      vacancies: parsed.data.vacancies,
      closing_date: parsed.data.closing_date || null,
      application_form_id: parsed.data.application_form_id || null,
      contract_template_id: newContract,
      owner_id: newOwner,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);

  if (error) return { error: "Could not save changes. Please try again." };

  // Audit a change of owner (transfer).
  if (newOwner && before?.owner_id !== newOwner) {
    await supabase.rpc("log_audit", {
      p_company_id: current.company_id,
      p_action: "job.owner_changed",
      p_entity_type: "job",
      p_entity_id: id,
      p_before: { owner_id: before?.owner_id ?? null },
      p_after: { owner_id: newOwner },
    });
  }

  // Only touch policies if the form actually manages them (it no longer does);
  // otherwise leave the existing acknowledgements untouched.
  if (formData.has("policy_ids")) {
    await syncJobPolicies(supabase, id, formData.getAll("policy_ids").map(String));
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  // Re-load the page fresh so every field (incl. the Contract select) shows the
  // saved values — avoids React's post-action form reset blanking the dropdown.
  redirect(`/jobs/${id}`);
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

/** Archive a job — only allowed once every applicant has been hired or moved to
 *  Not progressing, so nobody is left without a reply. Archived jobs drop out of
 *  the pipeline and the active jobs list into the reopenable Archived section. */
export async function archiveJob(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Missing job" };

  const { supabase, current } = await requireCompany();

  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id)
    .not("stage", "in", "(hired,rejected)");

  if ((count ?? 0) > 0) {
    return {
      error: `${count} applicant${count === 1 ? "" : "s"} still need a decision. Hire them or move them to Not progressing before archiving — that way everyone gets a reply.`,
    };
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not archive the job. Please try again." };

  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${id}`);
  return { ok: true };
}

/** Reopen an archived job — returns it to Closed (visible in jobs + pipeline,
 *  not listed publicly until re-published). */
export async function reopenJob(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase, current } = await requireCompany();
  await supabase
    .from("jobs")
    .update({ status: "closed", archived_at: null })
    .eq("id", id)
    .eq("company_id", current.company_id);

  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  revalidatePath(`/jobs/${id}`);
}
