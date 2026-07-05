import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarketingHeader, MarketingFooter, MarketingCta, NAVY_SECTION, GOLD_BTN } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "CIW safe recruitment in Wales: what inspectors expect | Join Care Now",
  description:
    "A plain-English guide to safe recruitment for care services in Wales: the fit and proper person test, the two-reference rule, DBS and the records CIW expects under the Regulated Services (Wales) Regulations 2017.",
  alternates: { canonical: "https://www.joincarenow.com/guides/ciw-safe-recruitment-wales" },
  openGraph: {
    title: "CIW safe recruitment in Wales: what inspectors expect",
    description: "The fit and proper person test, the two-reference rule, DBS and the records CIW expects under the 2017 regulations.",
    url: "https://www.joincarenow.com/guides/ciw-safe-recruitment-wales",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "article",
  },
};

const POINTS = [
  ["Fit and proper persons", "Everyone working in the service must be a fit and proper person for the role, judged on character, competence and conduct."],
  ["Two written references", "At least two written references, including one from the most recent employer where there is one."],
  ["DBS", "The appropriate level of criminal-record (DBS) check for the role."],
  ["Identity & right to work", "Confirm who the person is and that they are allowed to work in the UK."],
  ["Full history & suitability", "A full employment history with explanations for gaps, and evidence the person is suitable for the work."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Safe recruitment in Wales: what CIW expects",
  description:
    "A plain-English guide to safe recruitment for care services in Wales under the Regulated Services (Service Providers and Responsible Individuals) (Wales) Regulations 2017.",
  author: { "@type": "Organization", name: "Join Care Now" },
  publisher: { "@type": "Organization", name: "Join Care Now" },
  mainEntityOfPage: "https://www.joincarenow.com/guides/ciw-safe-recruitment-wales",
};

export default function CiwGuide() {
  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader />

      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Wales · CIW</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Safe recruitment in Wales: what CIW expects
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85">
            If you run a care service in Wales, Care Inspectorate Wales expects safe recruitment and
            clear records for everyone you employ. Here is what that means in plain English, and how
            to keep the evidence ready.
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-6 py-14">
        <div className="space-y-5 text-[15px] leading-relaxed text-gray-700">
          <h2 className="text-2xl font-bold text-gray-900">The rules that apply</h2>
          <p>
            Care services in Wales are regulated under the Regulation and Inspection of Social Care
            (Wales) Act 2016, with the day-to-day requirements set out in the Regulated Services
            (Service Providers and Responsible Individuals) (Wales) Regulations 2017. CIW expects
            providers to recruit in line with employment law, the Equality Act 2010 and best practice,
            and to hold specific information and documents for each person working in the service.
          </p>

          <h2 className="pt-4 text-2xl font-bold text-gray-900">What you need for each member of staff</h2>
          <p>The information and documents CIW expects for people working in a regulated service include:</p>
          <ul className="space-y-3">
            {POINTS.map(([title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <span><strong className="font-semibold text-gray-900">{title}.</strong> {body}</span>
              </li>
            ))}
          </ul>
          <p>
            The two-reference rule is the one people most often trip on: you need at least two written
            references, and one should come from the person&rsquo;s last employer where they have one.
            A verbal &ldquo;they were fine&rdquo; is not a record.
          </p>

          <h2 className="pt-4 text-2xl font-bold text-gray-900">The Responsible Individual</h2>
          <p>
            Welsh services also have a Responsible Individual, and CIW will want to see that the RI is
            competent and has the capacity to oversee the service, with an emphasis on effective
            management and continuous improvement. Safe recruitment is part of that oversight: the RI
            needs confidence that every file stands up.
          </p>

          <div className="my-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
            <h3 className="text-lg font-bold text-gray-900">How Join Care Now helps</h3>
            <p className="mt-2 text-gray-700">
              Join Care Now tracks references, DBS, Right to Work, identity and employment history
              against each person, and stores it all time-stamped in one place. References are
              requested and chased for you, the two-reference expectation is easy to see at a glance,
              and the whole recruitment file is ready when CIW asks. The same platform produces the
              staffing and turnover records a Responsible Individual needs for quality reporting.
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
            regulations and CIW&rsquo;s statutory guidance for the detail that applies to your service.
            Running a service in England instead?{" "}
            <Link href="/guides/cqc-regulation-19-safe-recruitment" className="font-medium text-amber-700 hover:underline">
              Read our CQC Regulation 19 guide
            </Link>.
          </p>
        </div>
      </article>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
