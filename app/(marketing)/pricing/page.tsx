import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { MarketingHeader, MarketingFooter, MarketingCta, NAVY_SECTION } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Pricing: care recruitment software from £49/month | Join Care Now",
  description:
    "Simple, transparent pricing for UK care providers. Core from £49/month, or Core plus Ruby (AI screening) from £89/month. No quote-chasing, no per-user fees, no hidden costs. Right to Work, DBS and references always included.",
  alternates: { canonical: "https://www.joincarenow.com/pricing" },
  openGraph: {
    title: "Pricing | Join Care Now",
    description:
      "Transparent care-software pricing from £49/month. No quote-chasing, no per-user fees. Right to Work, DBS and references always included.",
    url: "https://www.joincarenow.com/pricing",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "website",
  },
};

const ADD_ONS = [
  { label: "Extra branch", price: "£7.50 / month each" },
  { label: "Extra SMS", price: "8p each after your 100/month" },
  { label: "AI actions", price: "10p per action" },
  { label: "Forms", price: "from the File Store, priced per form" },
];

const FAQS = [
  {
    q: "Are there any hidden costs?",
    a: "No. The price you see is the price: £49 or £89 a month, with add-ons listed openly (extra branches, extra SMS, AI actions). No per-user fees, no compulsory setup packages, and no need to contact sales to find out what it costs.",
  },
  {
    q: "What is included in the base price?",
    a: "Core compliance is always in the base, never an add-on: careers pages, the applicant pipeline, onboarding with Right to Work, DBS and references, contracts and policies, the communication hub, and the employee record. Add Ruby, your AI screening assistant, when you are ready.",
  },
  {
    q: "Do you charge per user?",
    a: "No. Your whole team can use Join Care Now on either plan. You pay for the plan, not for seats, so adding a recruiter or manager never increases your bill.",
  },
  {
    q: "Is there a contract or setup fee?",
    a: "Monthly plans are rolling. Annual plans give you two months free, and there is no setup fee on annual plans. Whichever you choose, we set your first careers page and jobs up with you, so you start with a working system.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />

      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            Two plans, no quote-chasing and no hidden fees. Core compliance, Right to Work, DBS and
            references, is always in the base. Most care software makes you ask; we put it on the page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <PricingTiers />

        <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-gray-100 bg-gray-50 px-8 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pay only for what you use, on either plan</p>
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {ADD_ONS.map((a) => (
              <div key={a.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-700">{a.label}</span>
                <span className="font-medium text-gray-900">{a.price}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Training and compliance integrations are on the way, and will be included on every plan.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Pricing questions</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-gray-200 bg-white p-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-gray-500">
          Want to see the features first? <Link href="/features" className="font-medium text-amber-700 hover:underline">Explore what Join Care Now does</Link>.
        </p>
      </section>

      <MarketingCta title="Ready to see it on your own roles?" />
      <MarketingFooter />
    </main>
  );
}
