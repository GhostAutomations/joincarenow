import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireApplicant } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";
import { loadOnboardingDocument } from "@/modules/onboarding/actions";
import { SignDocument } from "@/components/portal/sign-document";

export default async function SignOnboardingDocPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { supabase, user } = await requireApplicant(`/portal/onboarding/${taskId}/sign`);

  const [doc, { data: me }] = await Promise.all([
    loadOnboardingDocument(taskId),
    supabase.from("applicants").select("first_name, last_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const defaultName = [me?.first_name, me?.last_name].filter(Boolean).join(" ");

  return (
    <main className="jcn-app min-h-screen jcn-app-bg">
      <header className="flex h-14 items-center justify-between border-b border-white/20 bg-white/70 px-4 backdrop-blur-md sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-700 sm:inline">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to my portal
        </Link>

        <div className="mt-4">
          {"error" in doc ? (
            <div className="rounded-2xl border border-white/40 bg-white/70 p-8 text-center text-sm text-gray-600 backdrop-blur-md">
              {doc.error}
            </div>
          ) : (
            <SignDocument
              taskId={taskId}
              title={doc.title}
              body={doc.body}
              kind={doc.kind}
              defaultName={defaultName}
              alreadySigned={doc.alreadySigned}
              signatureMethod={doc.signatureMethod}
            />
          )}
        </div>
      </div>
    </main>
  );
}
