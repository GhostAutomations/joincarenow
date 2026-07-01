import Link from "next/link";
import { MessageSquare } from "lucide-react";
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
import { OfferRespond } from "@/components/offer/offer-respond";
import { loadSignableDocs } from "@/modules/offers/actions";
import { PortalLive } from "@/components/portal/portal-live";
import { SignedDocs, type SignedDoc } from "@/components/documents/signed-docs";
import { ResignDocs } from "@/components/portal/resign-docs";
import type { ResignDoc } from "@/modules/signoff/actions";

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
  right_to_work: "Right to work",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not progressing",
};

const STAGE_STYLES: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  reviewing: "bg-indigo-100 text-indigo-800",
  interview: "bg-purple-100 text-purple-800",
  right_to_work: "bg-amber-100 text-amber-800",
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

  const [{ data }, { data: ivData }, { data: onbData }, { data: offerData }] = await Promise.all([
    supabase.rpc("get_my_applications"),
    supabase.rpc("get_my_interviews"),
    supabase.rpc("get_my_onboarding"),
    supabase.rpc("get_my_offers"),
  ]);
  const onboarding = (onbData ?? []) as PortalTask[];
  const applications = (data ?? []) as MyApplication[];
  type OfferRow = {
    token: string; status: string; role: string | null; start_date: string | null;
    pay: string | null; hours: string | null; conditional: boolean; conditions: string | null;
    message: string | null; company_name: string | null; job_title: string | null;
  };
  const offers = (offerData ?? []) as OfferRow[];
  // Load the documents to sign for any offer still awaiting a response.
  const offerDocs = new Map<string, Awaited<ReturnType<typeof loadSignableDocs>>>(
    await Promise.all(
      offers
        .filter((o) => o.status === "sent")
        .map(async (o) => [o.token, await loadSignableDocs(o.token)] as const)
    )
  );

  // The applicant's own name, to pre-fill the signature area.
  const { data: me } = await supabase
    .from("applicants")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const signerDefaultName = [me?.first_name, me?.last_name].filter(Boolean).join(" ");

  // The applicant's own signed contracts + policies (RLS scopes to them).
  const { data: signedRaw } = await supabase
    .from("signed_documents")
    .select("id, title, doc_type, signer_name, signed_at, signature_method, signature_image, body_snapshot, version, review_status, reject_reason")
    .order("signed_at", { ascending: false });
  // Docs sent back by staff for re-signing.
  const resignDocs: ResignDoc[] = (signedRaw ?? [])
    .filter((r) => r.review_status === "rejected")
    .map((r) => ({
      id: r.id as string,
      title: r.title as string,
      docType: r.doc_type as string,
      body: r.body_snapshot as string,
      signatureMethod: r.signature_method as string,
      rejectReason: (r.reject_reason as string) ?? null,
    }));
  // Everything else the applicant has signed (pending sign-off or approved).
  const signedDocs: SignedDoc[] = (signedRaw ?? [])
    .filter((r) => r.review_status !== "rejected")
    .map((r) => ({
      id: r.id as string,
      title: r.title as string,
      docType: r.doc_type as string,
      signerName: r.signer_name as string,
      signedAt: r.signed_at as string,
      signatureMethod: r.signature_method as string,
      signatureImage: (r.signature_image as string) ?? null,
      body: r.body_snapshot as string,
      version: (r.version as number) ?? null,
    }));
  const interviewByApp = new Map<string, PortalInterview>();
  for (const iv of (ivData ?? []) as (PortalInterview & {
    application_id: string;
  })[]) {
    interviewByApp.set(iv.application_id, iv);
  }

  return (
    <main className="jcn-app min-h-screen jcn-app-bg">
      <PortalLive />
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

      <div className="mx-auto max-w-3xl px-6 py-8">
        {resignDocs.length > 0 && (
          <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50/95 p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-amber-900">Action needed: please re-sign</h2>
            <p className="mt-1 text-sm text-amber-800">
              These were sent back because the signature needs redoing. Please sign again.
            </p>
            <ResignDocs docs={resignDocs} defaultName={signerDefaultName} />
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-white drop-shadow-sm">My applications</h1>
          <Link href="/portal/conversations" className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
            <MessageSquare className="h-4 w-4" /> Messages
          </Link>
        </div>

        {applied && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-sm">
            Your application has been submitted. The employer will be in touch.
          </div>
        )}

        {applications.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            You haven&apos;t applied for any roles yet. When you apply through an
            employer&apos;s careers page, your applications will appear here.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {applications.map((a) => {
              const interview = interviewByApp.get(a.application_id);
              return (
                <li
                  key={a.application_id}
                  className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-5 shadow-sm"
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

        {offers.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-white drop-shadow-sm">Your offer</h2>
            <p className="mt-1 text-sm text-white/80">Review your offer and let the employer know your decision.</p>
            {offers.map((o) => (
              <OfferRespond
                key={o.token}
                offer={{
                  token: o.token,
                  status: o.status,
                  role: o.role,
                  startDate: o.start_date,
                  pay: o.pay,
                  hours: o.hours,
                  conditional: o.conditional,
                  conditions: o.conditions,
                  message: o.message,
                  companyName: o.company_name ?? "The team",
                  jobTitle: o.job_title,
                  firstName: null,
                }}
                documents={offerDocs.get(o.token) ?? []}
                signerDefaultName={signerDefaultName}
              />
            ))}
          </section>
        )}

        {onboarding.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-white drop-shadow-sm">Your tasks</h2>
            <p className="mt-1 text-sm text-white/80">
              Please complete these tasks and forms. Your employer will review them.
            </p>
            <ul className="mt-4 space-y-3">
              {onboarding.map((t) => (
                <OnboardingTaskItem key={t.task_id} task={t} />
              ))}
            </ul>
          </section>
        )}

        {signedDocs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-white drop-shadow-sm">Your documents</h2>
            <p className="mt-1 text-sm text-white/80">
              The contracts and policies you&apos;ve signed. You can view or save a copy any time.
            </p>
            <div className="mt-4 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-5 shadow-sm">
              <SignedDocs docs={signedDocs} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
