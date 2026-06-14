import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Briefcase, Users, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

type PublicJob = {
  company_id: string;
  company_name: string;
  company_slug: string;
  job_id: string;
  job_slug: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  salary: string | null;
  vacancies: number;
  closing_date: string | null;
};

async function loadJob(
  companySlug: string,
  jobSlug: string
): Promise<PublicJob | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_public_job", {
      p_company_slug: companySlug,
      p_job_slug: jobSlug,
    })
    .maybeSingle<PublicJob>();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string; job: string }>;
}): Promise<Metadata> {
  const { company, job } = await params;
  const data = await loadJob(company, job);
  if (!data) return { title: "Job not found" };
  return {
    title: `${data.title} — ${data.company_name}`,
    description: data.description?.slice(0, 160),
  };
}

export default async function PublicJobPage({
  params,
}: {
  params: Promise<{ company: string; job: string }>;
}) {
  const { company, job } = await params;
  const data = await loadJob(company, job);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href={`/careers/${data.company_slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All roles at {data.company_name}
        </Link>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            {data.company_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {data.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
            {data.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {data.location}
              </span>
            )}
            {data.employment_type && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" aria-hidden />
                {data.employment_type}
              </span>
            )}
            {data.vacancies > 1 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden />
                {data.vacancies} vacancies
              </span>
            )}
            {data.closing_date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Closes {new Date(data.closing_date).toLocaleDateString("en-GB")}
              </span>
            )}
          </div>

          {data.salary && (
            <p className="mt-3 text-base font-semibold text-gray-900">
              {data.salary}
            </p>
          )}

          <div className="mt-6 border-t border-gray-100 pt-6">
            {data.description ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {data.description}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No description provided for this role.
              </p>
            )}
          </div>

          <div className="mt-8">
            <Link
              href={`/careers/${data.company_slug}/${data.job_slug}/apply`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-700"
            >
              Apply for this role
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          Powered by Join Care Now
        </p>
      </div>
    </main>
  );
}
