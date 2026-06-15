import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { updateJob, setJobStatus } from "@/modules/jobs/actions";
import { JobForm } from "@/components/dashboard/job-form";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
};

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const [{ data: job }, { data: forms }, { data: branches }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, slug, description, employment_type, branch_id, worker_category, salary, vacancies, closing_date, status, application_form_id"
      )
      .eq("id", id)
      .eq("company_id", current.company_id)
      .single(),
    supabase
      .from("forms")
      .select("id, name")
      .eq("company_id", current.company_id)
      .order("name"),
    supabase
      .from("branches")
      .select("id, name")
      .eq("company_id", current.company_id)
      .order("name"),
  ]);

  if (!job) notFound();

  const careersUrl = `/careers/${current.companies.slug}/${job.slug}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to jobs
      </Link>

      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{job.title}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            STATUS_STYLES[job.status] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {job.status}
        </span>
      </div>

      {/* Status controls */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
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
        </div>
        {job.status === "published" && (
          <p className="mt-2 text-xs text-gray-500">
            Public link: joincarenow.com{careersUrl}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <JobForm
          action={updateJob}
          submitLabel="Save changes"
          forms={forms ?? []}
          branches={branches ?? []}
          defaults={{
            id: job.id,
            title: job.title,
            description: job.description ?? "",
            employment_type: job.employment_type ?? "",
            branch_id: job.branch_id ?? "",
            worker_category: job.worker_category ?? "",
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
