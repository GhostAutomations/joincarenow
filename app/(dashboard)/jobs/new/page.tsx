import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createJob } from "@/modules/jobs/actions";
import { JobForm } from "@/components/dashboard/job-form";

export default async function NewJobPage() {
  // Guard: only company members reach this.
  const { supabase, current } = await requireCompany();
  const [{ data: forms }, { data: branches }, { data: roles }, { data: staff }, { data: wfRows }, { data: jobDescriptions }] = await Promise.all([
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).eq("category", "application").order("name"),
    supabase.from("branches").select("id, name, kind").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name, team").eq("company_id", current.company_id).order("team").order("position").order("name"),
    supabase.from("company_users").select("user_id, profiles(full_name, email)").eq("company_id", current.company_id),
    supabase.from("onboarding_templates").select("role_id, role_ids, workflow_name").eq("company_id", current.company_id).eq("is_store", false),
    supabase.from("job_descriptions").select("id, name").eq("company_id", current.company_id).order("name"),
  ]);
  const wfByRole = new Map<string, Set<string>>();
  for (const r of (wfRows ?? []) as { role_id: string | null; role_ids: string[] | null; workflow_name: string | null }[]) {
    const rids = r.role_ids && r.role_ids.length ? r.role_ids : (r.role_id ? [r.role_id] : []);
    for (const rid of rids) {
      const s = wfByRole.get(rid) ?? new Set<string>();
      if (r.workflow_name) s.add(r.workflow_name);
      wfByRole.set(rid, s);
    }
  }
  const workflows = [...wfByRole.entries()].map(([role_id, names]) => ({ role_id, workflow_name: [...names].join(", ") || "Workflow" }));
  const owners = (staff ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return { user_id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to jobs
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-white drop-shadow-sm">New job</h1>
      <p className="mt-1 text-sm text-white/80">
        Save as a draft first — you can publish it to your careers page from the
        job page once you&apos;re happy with it.
      </p>

      <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-6">
        <JobForm action={createJob} submitLabel="Save draft" forms={forms ?? []} branches={branches ?? []} roles={roles ?? []} workflows={workflows} jobDescriptions={jobDescriptions ?? []} owners={owners} />
      </div>
    </div>
  );
}
