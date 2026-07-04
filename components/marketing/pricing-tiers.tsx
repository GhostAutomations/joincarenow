"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";

/**
 * Interactive pricing cards with a Monthly / 12-month / Annual toggle.
 * Prices are static marketing copy — billing itself lives in the app.
 */

type Interval = "monthly" | "commit" | "annual";

const INTERVALS: { key: Interval; label: string; hint?: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "commit", label: "12-month", hint: "No setup fee" },
  { key: "annual", label: "Annual", hint: "2 months free" },
];

const PRICING: Record<
  Interval,
  { core: { price: string; per: string; note: string }; ruby: { price: string; per: string; note: string } }
> = {
  monthly: {
    core: { price: "£49", per: "/ month", note: "Cancel anytime · £150 one-off setup" },
    ruby: { price: "£89", per: "/ month", note: "Cancel anytime · £150 one-off setup" },
  },
  commit: {
    core: { price: "£49", per: "/ month", note: "12-month plan · no setup fee" },
    ruby: { price: "£79", per: "/ month", note: "12-month plan · no setup fee · save £120/yr" },
  },
  annual: {
    core: { price: "£490", per: "/ year", note: "2 months free · no setup fee" },
    ruby: { price: "£790", per: "/ year", note: "2 months free · no setup fee" },
  },
};

const CORE_INCLUDES = [
  "Every feature included: recruitment, onboarding and employee records",
  "Core compliance always in the base: Right to Work, DBS, references",
  "Branded careers page & applicant tracking",
  "Contracts & policies with e-signature",
  "Email & SMS messaging (100 SMS / month included)",
  "1 branch included",
];

const RUBY_INCLUDES = [
  "Everything in Core, plus Ruby",
  "AI screens each applicant against the role, your job description & policies",
  "Holds a friendly follow-up conversation with the candidate (consent-based)",
  "Writes a clear report with a hire recommendation for your team",
  "40 applicants screened / month included, then 75p each",
];

export function PricingTiers() {
  const [interval, setBillingInterval] = useState<Interval>("commit");
  const p = PRICING[interval];

  return (
    <div>
      {/* Toggle */}
      <div className="mx-auto mt-10 flex w-fit rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        {INTERVALS.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => setBillingInterval(i.key)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              interval === i.key ? "bg-brand-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {i.label}
            {i.hint && interval !== i.key && (
              <span className="ml-1.5 hidden text-[10px] font-medium text-brand-600 sm:inline">{i.hint}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Core */}
        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-200 bg-white shadow-lg ring-1 ring-brand-100">
          <div className="jcn-app-bg p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Core</p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-5xl font-bold">{p.core.price}</span>
              <span className="text-lg text-white/80">{p.core.per}</span>
            </p>
            <p className="mt-2 text-sm text-white/85">Everything you need to hire and onboard.</p>
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm">{p.core.note}</p>
            <a href="#demo" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white/90">
              Book a demo
            </a>
          </div>
          <div className="flex-1 p-8">
            <p className="text-sm font-semibold text-gray-900">What&apos;s included</p>
            <ul className="mt-4 space-y-2.5">
              {CORE_INCLUDES.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Core + Ruby */}
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-brand-500 bg-white shadow-xl ring-2 ring-brand-200">
          <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand-700 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Most popular
          </span>
          <div className="bg-gradient-to-br from-fuchsia-600 via-violet-600 to-brand-600 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/85">Core + Ruby</p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-5xl font-bold">{p.ruby.price}</span>
              <span className="text-lg text-white/80">{p.ruby.per}</span>
            </p>
            <p className="mt-2 text-sm text-white/90">Your AI recruitment assistant, built in.</p>
            <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-sm">{p.ruby.note}</p>
            <a href="#demo" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white/90">
              Book a demo
            </a>
          </div>
          <div className="flex-1 p-8">
            <p className="text-sm font-semibold text-gray-900">What&apos;s included</p>
            <ul className="mt-4 space-y-2.5">
              {RUBY_INCLUDES.map((pt) => (
                <li key={pt} className="flex items-start gap-2 text-sm text-gray-700">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
