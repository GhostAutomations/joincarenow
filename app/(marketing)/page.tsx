import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Megaphone,
  ClipboardList,
  ShieldCheck,
  MessageSquare,
  UserCheck,
  FileCheck2,
  Clock,
  Inbox,
  FolderKanban,
} from "lucide-react";
import { DemoForm } from "@/components/marketing/demo-form";
import { BoardMockup, OnboardingMockup } from "@/components/marketing/mockups";

export const metadata: Metadata = {
  title: "Care recruitment & onboarding software | Join Care Now",
  description:
    "Hire compliant care staff faster — without the spreadsheet chaos. Branded careers pages, applicant tracking, and full onboarding (Right to Work, DBS, references, contracts) in one place. Built for UK care providers.",
  alternates: { canonical: "https://www.joincarenow.com" },
  openGraph: {
    title: "Care recruitment & onboarding software | Join Care Now",
    description:
      "Hire compliant care staff faster — without the spreadsheet chaos. Branded careers pages, applicant tracking and full onboarding in one place. Built for UK care providers.",
    url: "https://www.joincarenow.com",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: Megaphone,
    title: "Fill roles faster with branded careers pages",
    proof: "Advertise every job on your own careers page and share the link anywhere — no job-board fees.",
  },
  {
    icon: FolderKanban,
    title: "Never lose a candidate again",
    proof: "Track every applicant on a simple board or table, so you always know who's waiting on what.",
  },
  {
    icon: ShieldCheck,
    title: "Safe recruitment, evidenced",
    proof: "Right to Work, DBS, references and employment history captured and stored against each person.",
  },
  {
    icon: FileCheck2,
    title: "Contracts & policies signed online",
    proof: "Send contracts and policies for e-signature and collect every required document in one place.",
  },
  {
    icon: MessageSquare,
    title: "Email & SMS without leaving the platform",
    proof: "Message candidates with templates and see what's been sent, delivered and replied to.",
  },
  {
    icon: UserCheck,
    title: "One employee record on hire",
    proof: "When someone's hired, their whole history becomes a single staff record — no re-keying.",
  },
];

const PROBLEMS = [
  { pain: "Chasing DBS and references over email", fix: "Every check requested, tracked and stored in one place." },
  { pain: "Good candidates going cold", fix: "See who needs a nudge and reply by email or SMS in seconds." },
  { pain: "Audit panic before an inspection", fix: "Recruitment records time-stamped and ready to evidence." },
  { pain: "Spreadsheets and inboxes everywhere", fix: "One simple system from advert to hired." },
];

const TIERS = [
  {
    name: "Starter",
    blurb: "For smaller teams getting organised.",
    points: ["Branded careers page", "Applicant tracking", "Core compliance: Right to Work, DBS, references", "Email & SMS messaging"],
  },
  {
    name: "Growth",
    blurb: "For growing providers hiring regularly.",
    points: ["Everything in Starter", "Full onboarding workflows", "Contracts & policies with e-signature", "Document collection & approval"],
    featured: true,
  },
  {
    name: "Enterprise",
    blurb: "For multi-branch organisations.",
    points: ["Everything in Growth", "Multiple branches & locations", "Advanced reporting", "Priority support"],
  },
];

const STEPS = [
  { n: "1", title: "Advertise", body: "Post your roles to a branded careers page and share the link." },
  { n: "2", title: "Track", body: "Review applicants and move them through your hiring steps." },
  { n: "3", title: "Onboard to hired", body: "Collect checks and documents, sign contracts, and create the staff record." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-xl font-bold text-white drop-shadow-sm">Join Care Now</span>
          <nav className="flex items-center gap-3 sm:gap-5">
            <a href="#pricing" className="hidden text-sm font-medium text-white/90 hover:text-white sm:inline">Pricing</a>
            <a href="#features" className="hidden text-sm font-medium text-white/90 hover:text-white sm:inline">Features</a>
            <Link href="/sign-in" className="text-sm font-medium text-white/90 hover:text-white">Staff sign in</Link>
            <a href="#demo" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white/90">Book a demo</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="jcn-app-bg relative overflow-hidden text-white">
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-32 text-center sm:pb-28 sm:pt-40">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Hire compliant care staff, faster — without the spreadsheet chaos
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90">
            Join Care Now brings recruitment and onboarding into one simple system built
            for UK care providers — from advert to a fully checked, ready-to-start hire.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-base font-semibold text-gray-900 shadow-sm transition hover:bg-white/90">
              Book a demo <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20">
              See pricing
            </a>
          </div>

          {/* Product preview */}
          <div className="mx-auto mt-16 max-w-5xl">
            <BoardMockup />
          </div>
        </div>
      </section>

      {/* Compliance / inspection-ready — the hook, right under the hero */}
      <section id="compliance" className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Inspection-ready</p>
              <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">Walk into inspection with the evidence ready</h2>
              <p className="mt-4 text-gray-600">
                Safe recruitment is at the heart of CQC Regulation 19 (fit and proper persons)
                and Regulation 17 (good governance and records) — with the equivalent
                expectations from CIW and Social Care Wales for Welsh providers. Join Care Now
                captures each check, time-stamps it, and stores it against the person, so the
                evidence is in one place when you need it.
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Join Care Now helps you stay organised and evidence safe recruitment. It does
                not replace your own checks — legal responsibility for compliance stays with
                your organisation.
              </p>
            </div>
            <OnboardingMockup />
          </div>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Recruitment shouldn&apos;t feel like firefighting
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
            If hiring lives across spreadsheets, inboxes and sticky notes, things slip.
            Join Care Now puts the whole journey in one calm place.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <div key={p.pain} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-medium text-gray-400 line-through decoration-gray-300">{p.pain}</p>
                <p className="mt-2 flex items-start gap-2 text-base font-medium text-gray-900">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {p.fix}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Everything you need to hire well</h2>
          <p className="mt-3 text-gray-600">
            Built for the realities of care hiring — and simple enough for a busy registered manager.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.proof}</p>
            </div>
          ))}
        </div>
        {/* PLACEHOLDER: product screenshots could sit here */}
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Simple, honest pricing</h2>
          <p className="mt-3 text-gray-600">
            No quote-chasing and no hidden fees. Core compliance — Right to Work, DBS and
            references — is included on every plan, never gated.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 ${t.featured ? "border-brand-400 shadow-lg ring-1 ring-brand-200" : "border-gray-200"}`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{t.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{t.blurb}</p>
              <p className="mt-4 text-2xl font-bold text-gray-900">
                Pricing on request
                {/* PLACEHOLDER: £/mo for the {t.name} tier — confirm before launch */}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    {pt}
                  </li>
                ))}
              </ul>
              <a href="#demo" className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${t.featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-gray-300 text-gray-900 hover:bg-gray-50"}`}>
                Book a demo
              </a>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          A training-platform integration (Carer.Academy) is coming soon.
        </p>
      </section>

      {/* How it works */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">From advert to hired in three steps</h2>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.n}</span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof (placeholders) */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Trusted by care teams</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[Clock, Inbox, ClipboardList].map((Icon, i) => (
            <div key={i} className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <Icon className="mx-auto h-6 w-6 text-gray-400" aria-hidden />
              <p className="mt-3 text-2xl font-bold text-gray-400">[PLACEHOLDER]</p>
              <p className="mt-1 text-sm text-gray-400">Outcome stat to add</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
          [PLACEHOLDER: customer testimonials and logos to add once available]
        </div>
      </section>

      {/* Demo / final CTA */}
      <section id="demo" className="jcn-app-bg relative overflow-hidden text-white">
        <div className="jcn-blob pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">See it on your own roles</h2>
              <p className="mt-4 text-white/90">
                Book a short, no-pressure demo. We&apos;ll show you how Join Care Now works
                for your setting and answer your questions. Tell us a little about your
                organisation and we&apos;ll be in touch to arrange a time.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/90">
                <li className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden /> Built for UK care providers</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden /> No obligation, no hard sell</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden /> Your data handled with care</li>
              </ul>
            </div>
            <div className="text-gray-900">
              <DemoForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <span className="text-lg font-bold text-brand-700">Join Care Now</span>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
              <a href="#features" className="hover:text-gray-900">Features</a>
              <a href="#pricing" className="hover:text-gray-900">Pricing</a>
              <a href="#demo" className="hover:text-gray-900">Book a demo</a>
              <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
              <Link href="/sign-in" className="hover:text-gray-900">Staff sign in</Link>
            </nav>
          </div>
          <p className="mt-8 text-sm text-gray-400">
            © {new Date().getFullYear()} Join Care Now · joincarenow.com
          </p>
        </div>
      </footer>
    </main>
  );
}
