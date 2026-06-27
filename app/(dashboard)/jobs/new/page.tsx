import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createJob } from "@/modules/jobs/actions";
import { JobForm } from "@/components/dashboard/job-form";

export default async function NewJobPage() {
  // Guard: only company members reach this.
  const { supabase, current } = await requireCompany();
  const [{ data: forms }, { data: branches }, { data: roles }, { data: contracts }, { data: policies }, { data: staff }] = await Promise.all([
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).eq("category", "application").order("name"),
    supabase.from("branches").select("id, name, kind").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name, team").eq("company_id", current.company_id).order("team").order("position").order("name"),
    supabase.from("contract_templates").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("policy_documents").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("company_users").select("user_id, profiles(full_name, email)").eq("company_id", current.company_id),
  ]);
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
        <JobForm action={createJob} submitLabel="Save draft" forms={forms ?? []} branches={branches ?? []} roles={roles ?? []} contracts={contracts ?? []} policies={policies ?? []} owners={owners} />
      </div>
    </div>
  );
}
