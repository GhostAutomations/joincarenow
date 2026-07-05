import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingHeader, MarketingFooter, MarketingCta, NAVY_SECTION } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Care recruitment & compliance guides | Join Care Now",
  description:
    "Plain-English guides to safe recruitment for UK care providers: CQC Regulation 19 (fit and proper persons employed) and CIW safe recruitment in Wales. What inspectors expect and how to keep the evidence ready.",
  alternates: { canonical: "https://www.joincarenow.com/guides" },
  openGraph: {
    title: "Care recruitment & compliance guides | Join Care Now",
    description: "Plain-English guides to safe recruitment for UK care providers: CQC Regulation 19 and CIW safe recruitment in Wales.",
    url: "https://www.joincarenow.com/guides",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "website",
  },
};

const GUIDES = [
  {
    href: "/guides/cqc-regulation-19-safe-recruitment",
    kicker: "England · CQC",
    title: "CQC Regulation 19: safe recruitment and fit and proper persons",
    blurb: "What Regulation 19 and Schedule 3 actually require, the six pre-employment checks, and what a recruitment file needs to show an inspector.",
  },
  {
    href: "/guides/ciw-safe-recruitment-wales",
    kicker: "Wales · CIW",
    title: "Safe recruitment in Wales: what CIW expects",
    blurb: "The fit and proper person test, the two-reference rule, and the records CIW expects under the 2017 regulations for care services in Wales.",
  },
];

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />

      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Recruitment &amp; compliance guides</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            Plain-English guides to safe recruitment in UK care. What the regulators expect, and
            how to keep the evidence ready without the audit-day scramble.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="group flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-amber-400 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{g.kicker}</p>
              <h2 className="mt-2 text-lg font-bold text-gray-900 group-hover:text-amber-700">{g.title}</h2>
              <p className="mt-2 flex-1 text-sm text-gray-600">{g.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                Read the guide <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
