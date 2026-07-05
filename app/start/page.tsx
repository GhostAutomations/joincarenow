import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { selfServeEnabled } from "@/lib/flags";
import { SelfServeSignupForm } from "@/components/marketing/self-serve-form";
import { MarketingHeader, MarketingFooter, NAVY_SECTION } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Start your free trial | Join Care Now",
  description:
    "Create your care company account and start a free trial of Join Care Now: branded careers pages, applicant tracking and full onboarding, with Ruby, your AI screening assistant.",
  alternates: { canonical: "https://www.joincarenow.com/start" },
  robots: { index: false }, // signup page, not an SEO target
};

const POINTS = [
  "Advertise roles on a branded careers page in minutes",
  "Track every applicant and never lose one",
  "Right to Work, DBS, references and contracts built in",
  "Ruby screens your applicants for you",
];

export default function StartPage() {
  // Gated until the entity + terms are live. Until then, send visitors to the demo.
  if (!selfServeEnabled()) redirect("/#demo");

  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />
      <section className={`${NAVY_SECTION} relative overflow-hidden`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-2">
          <div className="text-white">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Start your free trial</h1>
            <p className="mt-4 max-w-md text-white/85">
              Create your account and get your care hiring into one calm system. No obligation, and
              we&apos;ll help you get set up.
            </p>
            <ul className="mt-8 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-white/90">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-300">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-white/70">
              Prefer a walkthrough first?{" "}
              <Link href="/#demo" className="font-medium text-amber-300 hover:underline">Book a demo</Link>.
            </p>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
            <h2 className="text-lg font-bold text-gray-900">Create your company account</h2>
            <p className="mt-1 text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-amber-700 hover:underline">Sign in</Link>.
            </p>
            <div className="mt-5">
              <SelfServeSignupForm />
            </div>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
