import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createJob } from "@/modules/jobs/actions";
import { JobForm } from "@/components/dashboard/job-form";

export default async function NewJobPage() {
  // Guard: only company members reach this.
  await requireCompany();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to jobs
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900">New job</h1>
      <p className="mt-1 text-sm text-gray-500">
        Save as a draft first — you can publish it to your careers page from the
        job page once you&apos;re happy with it.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <JobForm action={createJob} submitLabel="Save draft" />
      </div>
    </div>
  );
}
