import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarketingHeader, MarketingFooter, MarketingCta, NAVY_SECTION, GOLD_BTN } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "CQC Regulation 19: safe recruitment & fit and proper persons | Join Care Now",
  description:
    "A plain-English guide to CQC Regulation 19 (fit and proper persons employed) and Schedule 3: the six pre-employment checks, what a recruitment file must show, and how to keep the evidence inspection-ready.",
  alternates: { canonical: "https://www.joincarenow.com/guides/cqc-regulation-19-safe-recruitment" },
  openGraph: {
    title: "CQC Regulation 19: safe recruitment & fit and proper persons",
    description: "The six pre-employment checks, what Schedule 3 requires, and how to keep your recruitment records inspection-ready.",
    url: "https://www.joincarenow.com/guides/cqc-regulation-19-safe-recruitment",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "article",
  },
};

const CHECKS = [
  ["Identity", "Confirm the person is who they say they are, with documentary evidence."],
  ["Right to Work", "Confirm they are legally allowed to work in the UK before they start."],
  ["Professional registration & qualifications", "Evidence of any registration and qualifications relevant to the role."],
  ["Employment history & references", "A full employment history with a satisfactory written explanation of any gaps, plus references that meet Schedule 3."],
  ["Criminal record (DBS)", "The appropriate level of DBS check for the role, obtained before or as they start."],
  ["Work health assessment", "Satisfactory information about any physical or mental health condition relevant to the role, after reasonable adjustments."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "CQC Regulation 19: safe recruitment and fit and proper persons employed",
  description:
    "A plain-English guide to CQC Regulation 19 and Schedule 3 for UK care providers: the six pre-employment checks and what a recruitment file must show.",
  author: { "@type": "Organization", name: "Join Care Now" },
  publisher: { "@type": "Organization", name: "Join Care Now" },
  mainEntityOfPage: "https://www.joincarenow.com/guides/cqc-regulation-19-safe-recruitment",
};

export default function Reg19Guide() {
  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader />

      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">England · CQC</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            CQC Regulation 19: safe recruitment and fit and proper persons
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85">
            If you run a care service in England, Regulation 19 is the one an inspector reaches for
            when they open a staff file. Here is what it asks for, in plain English, and how to keep
            the evidence ready before anyone asks.
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-6 py-14">
        <div className="space-y-5 text-[15px] leading-relaxed text-gray-700">
          <h2 className="text-2xl font-bold text-gray-900">What Regulation 19 actually says</h2>
          <p>
            Regulation 19 of the Health and Social Care Act 2008 (Regulated Activities) Regulations
            2014 is titled &ldquo;fit and proper persons employed&rdquo;. In short, everyone you
            employ to deliver or manage care must be of good character, physically and mentally able
            to do the job, and suitably qualified, skilled and experienced for it. Before they start,
            you must obtain the information set out in Schedule 3 of the regulations.
          </p>
          <p>
            It is not enough to do the checks. You have to be able to show you did them, for every
            member of staff, whenever an inspector asks. That evidence lives in the recruitment file,
            and thin or missing files are one of the most common shortfalls CQC finds.
          </p>

          <h2 className="pt-4 text-2xl font-bold text-gray-900">The six pre-employment checks</h2>
          <p>Schedule 3 boils down to six checks you complete before someone starts:</p>
          <ul className="space-y-3">
            {CHECKS.map(([title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <span><strong className="font-semibold text-gray-900">{title}.</strong> {body}</span>
              </li>
            ))}
          </ul>

          <h2 className="pt-4 text-2xl font-bold text-gray-900">References, gaps and good character</h2>
          <p>
            References must, at a minimum, provide the information specified in Schedule 3, and should
            normally include one from the most recent employer. A full employment history matters too:
            where there are gaps, you need a satisfactory written explanation on file, not a shrug. For
            roles where values and judgement matter, inspectors increasingly want to see evidence that
            you tested them, such as a record of the questions asked at interview, the answers given,
            and your considered assessment of the person&rsquo;s suitability.
          </p>

          <h2 className="pt-4 text-2xl font-bold text-gray-900">It does not stop at hire</h2>
          <p>
            Regulation 19 also expects ongoing monitoring, so staff remain fit for their role, and
            appropriate arrangements for when someone is no longer able to carry out their duties.
            Time-limited checks, like a Right to Work with an expiry date, need to be kept current
            rather than filed and forgotten.
          </p>

          <div className="my-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
            <h3 className="text-lg font-bold text-gray-900">How Join Care Now helps</h3>
            <p className="mt-2 text-gray-700">
              Join Care Now keeps every one of these checks against the person, requested, chased,
              approved and time-stamped, so a recruitment file assembles itself as you hire. Right to
              Work, DBS and references are tracked, contracts and policies are signed online, and
              expiry dates are chased for you. When an inspection comes, the evidence is already there.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Join Care Now helps you stay organised and evidence safe recruitment. It supports your
              checks; it does not replace them, and legal responsibility for compliance stays with
              your organisation.
            </p>
            <Link href="/#demo" className={`mt-5 ${GOLD_BTN}`}>
              See it on your own roles <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <p className="text-sm text-gray-500">
            This guide is general information, not legal or regulatory advice. Always check the current
            wording of Regulation 19 and Schedule 3 and CQC&rsquo;s guidance for the detail that applies
            to your service. Running a service in Wales instead?{" "}
            <Link href="/guides/ciw-safe-recruitment-wales" className="font-medium text-amber-700 hover:underline">
              Read our CIW safe-recruitment guide
            </Link>.
          </p>
        </div>
      </article>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
