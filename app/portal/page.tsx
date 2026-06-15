import Link from "next/link";
import { requireApplicant } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";
import {
  InterviewInvite,
  type PortalInterview,
} from "@/components/portal/interview-invite";
import {
  OnboardingTaskItem,
  type PortalTask,
} from "@/components/portal/onboarding-task-item";

type MyApplication = {
  application_id: string;
  stage: string;
  created_at: string;
  job_title: string;
  company_name: string;
  company_slug: string;
  job_slug: string;
};

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Under review",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not progressing",
};

const STAGE_STYLES: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  reviewing: "bg-indigo-100 text-indigo-800",
  interview: "bg-purple-100 text-purple-800",
  offer: "bg-green-100 text-green-800",
  hired: "bg-green-100 text-green-800",
  rejected: "bg-gray-100 text-gray-600",
};

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string }>;
}) {
  const { supabase, user } = await requireApplicant();
  const { applied } = await searchParams;

  const [{ data }, { data: ivData }, { data: onbData }] = await Promise.all([
    supabase.rpc("get_my_applications"),
    supabase.rpc("get_my_interviews"),
    supabase.rpc("get_my_onboarding"),
  ]);
  const onboarding = (onbData ?? []) as PortalTask[];
  const applications = (data ?? []) as MyApplication[];
  const interviewByApp = new Map<string, PortalInterview>();
  for (const iv of (ivData ?? []) as (PortalInterview & {
    application_id: string;
  })[]) {
    interviewByApp.set(iv.application_id, iv);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-700 sm:inline">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">My applications</h1>

        {applied && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Your application has been submitted. The employer will be in touch.
          </div>
        )}

        {applications.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">
            You haven&apos;t applied for any roles yet. When you apply through an
            employer&apos;s careers page, your applications will appear here.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {applications.map((a) => {
              const interview = interviewByApp.get(a.application_id);
              return (
                <li
                  key={a.application_id}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/careers/${a.company_slug}/${a.job_slug}`}
                        className="font-medium text-gray-900 hover:text-brand-700"
                      >
                        {a.job_title}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {a.company_name} · applied{" "}
                        {new Date(a.created_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STAGE_STYLES[a.stage] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STAGE_LABEL[a.stage] ?? a.stage}
                    </span>
                  </div>
                  {interview && <InterviewInvite interview={interview} />}
                </li>
              );
            })}
          </ul>
        )}

        {onboarding.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900">Your tasks</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please complete these tasks and forms. Your employer will review them.
            </p>
            <ul className="mt-4 space-y-3">
              {onboarding.map((t) => (
                <OnboardingTaskItem key={t.task_id} task={t} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
