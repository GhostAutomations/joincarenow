import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireApplicant } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";
import { OnboardingFormFill } from "@/components/portal/onboarding-form-fill";
import { type FormField } from "@/components/careers/apply-form";

export default async function OnboardingFormPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { supabase, user } = await requireApplicant(`/portal/onboarding/${taskId}`);

  const [{ data }, { data: prev }] = await Promise.all([
    supabase.rpc("get_onboarding_form", { p_task_id: taskId }),
    supabase.rpc("get_onboarding_form_answers", { p_task_id: taskId }),
  ]);
  const fields = (data ?? []) as FormField[];
  const defaults = (prev ?? {}) as Record<string, string | string[]>;

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

      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to my portal
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Onboarding form</h1>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-500">
              This form has no questions, or it isn&apos;t available. Go back to
              your portal.
            </p>
          ) : (
            <OnboardingFormFill taskId={taskId} fields={fields} defaults={defaults} />
          )}
        </div>
      </div>
    </main>
  );
}
