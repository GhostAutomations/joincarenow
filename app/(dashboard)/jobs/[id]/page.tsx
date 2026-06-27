import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { updateJob, setJobStatus, reopenJob } from "@/modules/jobs/actions";
import { JobForm } from "@/components/dashboard/job-form";
import { ArchiveJobButton } from "@/components/dashboard/archive-job";
import { JobPromote } from "@/components/dashboard/job-promote";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
  archived: "bg-gray-200 text-gray-600",
};

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const [{ data: job }, { data: forms }, { data: branches }, { data: roles }, { data: company }, { data: staff }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, slug, description, location, employment_type, branch_id, role_id, workflow_role_id, salary, vacancies, closing_date, status, application_form_id, contract_template_id, owner_id"
      )
      .eq("id", id)
      .eq("company_id", current.company_id)
      .single(),
    supabase
      .from("forms")
      .select("id, name")
      .eq("company_id", current.company_id)
      .eq("category", "application")
      .order("name"),
    supabase
      .from("branches")
      .select("id, name, kind")
      .eq("company_id", current.company_id)
      .order("name"),
    supabase
      .from("roles")
      .select("id, name, team")
      .eq("company_id", current.company_id)
      .order("team")
      .order("position")
      .order("name"),
    supabase
      .from("companies")
      .select("name, settings")
      .eq("id", current.company_id)
      .single(),
    supabase
      .from("company_users")
      .select("user_id, profiles(full_name, email)")
      .eq("company_id", current.company_id),
  ]);

  if (!job) notFound();

  const owners = (staff ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string | null } | null;
    return { user_id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });
  const ownerName = owners.find((o) => o.user_id === (job as { owner_id?: string | null }).owner_id)?.name;

  const careersUrl = `/careers/${current.companies.slug}/${job.slug}`;
  const companyRow = company as { name: string | null; settings: { brand?: { primary?: string | null; logo_url?: string | null } | null } | null } | null;
  const brand = companyRow?.settings?.brand ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to jobs
      </Link>

      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">{job.title}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[job.status] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {job.status}
        </span>
      </div>
      {ownerName && (
        <p className="mt-1 text-sm text-white/80">
          Managed by {ownerName} · they receive this job&apos;s applicant notifications
        </p>
      )}

      {/* Status controls */}
      <div className="mt-4 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {job.status !== "published" && (
            <form action={setJobStatus}>
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="published" />
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Publish to careers page
              </button>
            </form>
          )}
          {job.status === "published" && (
            <>
              <Link
                href={careersUrl}
                target="_blank"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                View / share public page
              </Link>
              <form action={setJobStatus}>
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="status" value="closed" />
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                  Close job
                </button>
              </form>
            </>
          )}
          {job.status === "closed" && (
            <form action={setJobStatus}>
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="published" />
              <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                Re-open
              </button>
            </form>
          )}
          {job.status === "archived" && (
            <form action={reopenJob}>
              <input type="hidden" name="id" value={job.id} />
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Reopen job
              </button>
            </form>
          )}
          {job.status !== "archived" && job.status !== "draft" && (
            <ArchiveJobButton id={job.id} />
          )}
        </div>
        {job.status === "published" && (
          <p className="mt-2 text-xs text-gray-500">
            Public link: joincarenow.com{careersUrl}
          </p>
        )}
      </div>

      {job.status === "published" && (
        <JobPromote
          companyName={companyRow?.name ?? current.companies.name}
          jobTitle={job.title}
          location={job.location ?? null}
          salary={job.salary ?? null}
          employmentType={job.employment_type ?? null}
          jobUrl={`https://www.joincarenow.com${careersUrl}`}
          brandPrimary={brand?.primary ?? null}
          logoUrl={brand?.logo_url ?? null}
        />
      )}

      <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-6">
        <JobForm
          action={updateJob}
          submitLabel="Save changes"
          forms={forms ?? []}
          branches={branches ?? []}
          roles={roles ?? []}
          owners={owners}
          defaults={{
            id: job.id,
            title: job.title,
            owner_id: (job as { owner_id?: string | null }).owner_id ?? "",
            description: job.description ?? "",
            employment_type: job.employment_type ?? "",
            branch_id: job.branch_id ?? "",
            role_id: job.role_id ?? "",
            workflow_role_id: (job as { workflow_role_id?: string | null }).workflow_role_id ?? "",
            salary: job.salary ?? "",
            vacancies: job.vacancies,
            closing_date: job.closing_date ?? "",
            application_form_id: job.application_form_id ?? "",
          }}
        />
      </div>
    </div>
  );
}
