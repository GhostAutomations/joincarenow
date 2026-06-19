import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Briefcase, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandStyle } from "@/components/dashboard/brand-style";
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

type PublicProfile = {
  company_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
  intro: string | null;
  benefits: string[];
};

async function loadCareers(slug: string): Promise<CareersRow[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_careers", { p_slug: slug });
  const rows = (data ?? []) as CareersRow[];
  return rows.length === 0 ? null : rows;
}

async function loadProfile(slug: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_company_public_profile", { p_slug: slug })
    .maybeSingle<PublicProfile>();
  return data ?? null;
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
  const [rows, profile] = await Promise.all([loadCareers(company), loadProfile(company)]);
  // 404 only if the company genuinely doesn't exist. A company with no published
  // jobs still renders, showing the "no vacancies" state below.
  if (!rows && !profile) notFound();

  const companyName = profile?.name ?? rows?.[0]?.company_name ?? "Careers";
  const jobs = (rows ?? []).filter((r) => r.job_id) as Required<CareersRow>[];
  const benefits = profile?.benefits ?? [];
  const brand = profile
    ? {
        primary: profile.brand_primary,
        secondary: profile.brand_secondary,
        accent: profile.brand_accent,
      }
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <BrandStyle brand={brand} />

      {/* Branded hero */}
      <header className="jcn-app-bg relative overflow-hidden text-white">
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-14 sm:py-20">
          {profile?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logo_url}
              alt={companyName}
              className="mb-5 h-14 w-auto max-w-[220px] rounded-lg bg-white/90 object-contain p-2"
            />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Careers</p>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Join the team at {companyName}
          </h1>
          {profile?.intro ? (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-base text-white/90 sm:text-lg">
              {profile.intro}
            </p>
          ) : (
            <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
              We&apos;re looking for caring people to join our team. Explore our
              open roles below.
            </p>
          )}
          {jobs.length > 0 && (
            <div className="mt-6">
              <a
                href="#roles"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white/90"
              >
                See {jobs.length} open {jobs.length === 1 ? "role" : "roles"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Benefits */}
      {benefits.length > 0 && (
        <section className="border-b border-gray-100 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Why work with us
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                    <Check className="h-3 w-3" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Roles */}
      <section id="roles" className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="text-lg font-semibold text-gray-900">
          Open roles{" "}
          <span className="font-normal text-gray-400">
            ({jobs.length})
          </span>
        </h2>

        {jobs.length === 0 ? (
          <p className="mt-4 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
            No vacancies at the moment — please check back soon.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {jobs.map((job) => (
              <li key={job.job_id}>
                <Link
                  href={`/careers/${job.company_slug}/${job.job_slug}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-700">
                      {job.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                      {job.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-gray-400" aria-hidden />
                          {job.location}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4 text-gray-400" aria-hidden />
                          {job.employment_type}
                        </span>
                      )}
                      {job.salary && (
                        <span className="font-medium text-gray-800">{job.salary}</span>
                      )}
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-brand-700 sm:inline-flex">
                    View &amp; apply
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mx-auto max-w-4xl px-6 py-10 text-center text-sm text-gray-400">
        Powered by Join Care Now
      </footer>
    </main>
  );
}
