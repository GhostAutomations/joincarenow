import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm, type FormField } from "@/components/careers/apply-form";
import { BrandStyle } from "@/components/dashboard/brand-style";

type PublicJob = {
  company_name: string;
  company_slug: string;
  job_id: string;
  job_slug: string;
  title: string;
};

type PublicProfile = {
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_accent: string | null;
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ company: string; job: string }>;
}) {
  const { company, job } = await params;
  const applyPath = `/careers/${company}/${job}/apply`;

  const supabase = await createClient();

  const { data: jobData } = await supabase
    .rpc("get_public_job", { p_company_slug: company, p_job_slug: job })
    .maybeSingle<PublicJob>();

  if (!jobData) notFound();

  // Must be signed in as an applicant to apply.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/applicant/sign-up?next=${encodeURIComponent(applyPath)}`);
  }

  // Prefill from an existing applicant profile, if any.
  const { data: applicant } = await supabase
    .from("applicants")
    .select("first_name, last_name, phone, postcode")
    .eq("user_id", user.id)
    .maybeSingle();

  // Custom application-form fields assigned to this job, if any.
  const { data: fieldsData } = await supabase.rpc("get_application_form", {
    p_job_id: jobData.job_id,
  });
  const formFields = (fieldsData ?? []) as FormField[];

  const [{ data: profile }, { data: opts }] = await Promise.all([
    supabase.rpc("get_company_public_profile", { p_slug: company }).maybeSingle<PublicProfile>(),
    supabase
      .rpc("get_company_field_options", { p_slug: company })
      .maybeSingle<{ branches: string[]; roles: string[] }>(),
  ]);
  const managed = {
    branch: opts?.branches ?? [],
    role: opts?.roles ?? [],
  };
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
      <div className="jcn-app-bg">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <Link
            href={`/careers/${jobData.company_slug}/${jobData.job_slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to job
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-6 py-8">

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
          Apply: {jobData.title}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          at {jobData.company_name}. Signed in as {user.email}.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          <ApplyForm
            jobId={jobData.job_id}
            formFields={formFields}
            managed={managed}
            defaults={{
              firstName: applicant?.first_name ?? "",
              lastName: applicant?.last_name ?? "",
              phone: applicant?.phone ?? "",
              postcode: applicant?.postcode ?? "",
            }}
          />
        </div>
      </div>
    </main>
  );
}
