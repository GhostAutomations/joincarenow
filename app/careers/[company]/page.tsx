import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

type CareersRow = {
  company_id: string;
  company_name: string;
  company_slug: string;
  job_id: string | null;
  job_slug: string | null;
  title: string | null;
  location: string | null;
  employment_type: string | null;
  salary: string | null;
};

async function loadCareers(slug: string): Promise<CareersRow[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_careers", { p_slug: slug });
  const rows = (data ?? []) as CareersRow[];
  return rows.length === 0 ? null : rows;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string }>;
}): Promise<Metadata> {
  const { company } = await params;
  const rows = await loadCareers(company);
  const name = rows?.[0]?.company_name;
  return {
    title: name ? `Careers at ${name}` : "Careers",
    description: name ? `Current job openings at ${name}.` : undefined,
  };
}

export default async function CompanyCareersPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const rows = await loadCareers(company);
  if (!rows) notFound();

  const companyName = rows[0].company_name;
  const jobs = rows.filter((r) => r.job_id) as Required<CareersRow>[];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            Careers
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            {companyName}
          </h1>
          <p className="mt-2 text-gray-600">
            {jobs.length === 0
              ? "There are no open roles right now — please check back soon."
              : `${jobs.length} open role${jobs.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.job_id}>
              <Link
                href={`/careers/${job.company_slug}/${job.job_slug}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  {job.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" aria-hidden />
                      {job.location}
                    </span>
                  )}
                  {job.employment_type && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" aria-hidden />
                      {job.employment_type}
                    </span>
                  )}
                  {job.salary && (
                    <span className="font-medium text-gray-700">{job.salary}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto max-w-4xl px-6 py-10 text-center text-sm text-gray-400">
        Powered by Join Care Now
      </footer>
    </main>
  );
}
