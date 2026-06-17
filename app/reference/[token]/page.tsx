import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RefereeForm } from "@/components/reference/referee-form";
import { type FormField } from "@/components/careers/apply-form";

export default async function ReferenceTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: ctxData }, { data: fieldData }] = await Promise.all([
    supabase.rpc("get_reference_by_token", { p_token: token }),
    supabase.rpc("get_reference_form_by_token", { p_token: token }),
  ]);
  const ctx = (ctxData as Record<string, unknown>[] | null)?.[0];
  if (!ctx) notFound();

  const fields = (fieldData ?? []) as FormField[];
  const status = ctx.status as string;
  const companyName = (ctx.company_name as string) ?? "the employer";
  const applicantName = (ctx.applicant_name as string) ?? "the applicant";
  const jobTitle = (ctx.job_title as string) ?? null;
  const refereeName = (ctx.referee_name as string) ?? "";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Employment reference</h1>
        <p className="mt-2 text-sm text-gray-600">
          {refereeName ? `Hello ${refereeName}. ` : ""}
          {applicantName} has applied for {jobTitle ? `the ${jobTitle} role` : "a role"} with{" "}
          {companyName} and has given your name as a referee. Please complete the short reference
          below. Your answers go directly and securely to {companyName}.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
          {status === "approved" ? (
            <p className="text-sm text-gray-600">
              This reference has already been completed. Thank you.
            </p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-gray-500">This reference form isn&apos;t available right now.</p>
          ) : (
            <RefereeForm token={token} fields={fields} />
          )}
        </div>
      </div>
    </main>
  );
}
