import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  X,
  ShieldCheck,
  MessageSquare,
  UserCheck,
  FileCheck2,
  Sparkles,
  Heart,
  ChevronDown,
} from "lucide-react";
import { DemoForm } from "@/components/marketing/demo-form";
import { BoardMockup, OnboardingMockup, CommsMockup, CareersMockup } from "@/components/marketing/mockups";
import { RubyDemo } from "@/components/marketing/ruby-demo";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { selfServeEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Care recruitment & onboarding software | Join Care Now",
  description:
    "Hire compliant care staff faster. Ruby, your AI assistant, does the first-round screening for you. Careers pages, applicant tracking and full onboarding (Right to Work, DBS, references, contracts) in one calm, inspection-ready system. Built for UK care providers, from £49/month.",
  alternates: { canonical: "https://www.joincarenow.com" },
  openGraph: {
    title: "Care recruitment & onboarding software | Join Care Now",
    description:
      "Hire compliant care staff faster. Ruby, your AI assistant, does the first-round screening for you. One calm, inspection-ready system built for UK care providers.",
    url: "https://www.joincarenow.com",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "website",
  },
};

/** Navy and gold theme tokens (marketing pages only). */
const NAVY_SECTION = "bg-gradient-to-br from-[#081231] via-[#0d1d4b] to-[#14306b]";
const GOLD_BTN =
  "inline-flex items-center gap-2 rounded-lg bg-amber-400 px-7 py-3.5 text-base font-semibold text-[#081231] shadow-sm transition hover:bg-amber-300";
const NAVY_BTN =
  "inline-flex items-center gap-2 rounded-lg bg-[#0d1d4b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#14306b]";

function Wordmark({ className = "text-xl sm:text-2xl" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="-mb-1 inline-block bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text pb-1 text-transparent drop-shadow-sm">
        Join Care Now
      </span>
    </span>
  );
}

const STATS = [
  { big: "£49", small: "a month, with pricing you can see up front" },
  { big: "40", small: "applicants screened by Ruby every month on Core + Ruby" },
  { big: "1", small: "calm system from advert to first shift" },
  { big: "0", small: "spreadsheets, sticky notes or lost candidates" },
];

const SHOWCASES = [
  {
    kicker: "Your careers page",
    title: "Advertise every role under your own brand",
    body:
      "Your jobs live on a branded careers page that's found on Google and shareable anywhere, with no job board fees and no third-party branding. Candidates apply on any device with your own application form.",
    points: ["Found on Google for Jobs", "Share links, social posts and QR posters", "Closes automatically on your closing date"],
    mock: <CareersMockup />,
  },
  {
    kicker: "Your pipeline",
    title: "See every candidate, never lose one again",
    body:
      "In care, the best applicants are gone in days. Your pipeline shows every candidate at a glance: who's waiting on what, and who needs a nudge. People move from applied to first shift without the gaps.",
    points: ["Drag-and-drop hiring stages", "Progress and missing items on every card", "Ruby's report right on the applicant"],
    mock: <BoardMockup />,
  },
  {
    kicker: "Your messages",
    title: "Email and SMS without leaving the system",
    body:
      "Message candidates by email or text with templates and merge fields, see what's delivered and opened, and keep the whole conversation on the applicant's timeline instead of losing it in someone's inbox.",
    points: ["Templates with merge fields", "Delivery and open tracking", "Every message on the applicant's record"],
    mock: <CommsMockup />,
  },
  {
    kicker: "Your evidence",
    title: "Walk into your next inspection with the evidence ready",
    body:
      "Safe recruitment sits at the heart of CQC Regulation 19 and 17, with equivalent expectations from CIW. Every check, from Right to Work and DBS to references and contracts, is captured, time-stamped and stored against the person, ready the moment you need it.",
    points: ["Right to Work, DBS & references tracked", "Contracts & policies e-signed and filed", "Time-stamped audit trail on everything"],
    mock: <OnboardingMockup />,
  },
];

const PROBLEMS = [
  { pain: "Audit panic before an inspection", fix: "Recruitment records time-stamped and ready to evidence." },
  { pain: "Spreadsheets and inboxes everywhere", fix: "One simple system from advert to hired." },
  { pain: "Chasing DBS and references over email", fix: "Every check requested, tracked and stored in one place." },
  { pain: "Good candidates going cold", fix: "See who needs a nudge and reply by email or SMS in seconds." },
  { pain: "Evenings lost to first-round screening calls", fix: "Ruby holds the first conversation and writes the report for you." },
  { pain: "A pile of applications you can't tell apart", fix: "A clear screening report and recommendation on every applicant." },
];

const COMPARISON = [
  { label: "Everything from advert to hired in one place" },
  { label: "Right to Work, DBS & references tracked and evidenced" },
  { label: "Candidate email & SMS built in" },
  { label: "Contracts & policies signed online" },
  { label: "Ruby, AI screening on every applicant" },
  { label: "Built for care, not adapted to it" },
];

const ADD_ONS = [
  { label: "Extra branch", price: "£7.50 / month each" },
  { label: "Extra SMS", price: "8p each after your 100/month" },
  { label: "AI actions", price: "10p per action" },
  { label: "Forms", price: "from the File Store, priced per form" },
];

const STEPS = [
  { n: "1", title: "Advertise", body: "Post your roles to a branded careers page and share the link." },
  { n: "2", title: "Ruby screens", body: "On Core + Ruby, every applicant is reviewed and interviewed by Ruby, with a report for your team." },
  { n: "3", title: "Track & interview", body: "Move applicants through your hiring steps and book interviews by email or SMS." },
  { n: "4", title: "Onboard to hired", body: "Collect checks and documents, sign contracts, and create the staff record." },
];

const FAQS = [
  {
    q: "We manage hiring in spreadsheets today. Why change?",
    a: "Spreadsheets don't chase references, text candidates, or produce a time-stamped audit trail when an inspector asks. Everything you do in the spreadsheet still happens (advertising, tracking, checking), it just happens in one place, with the evidence kept for you. Most teams are fully moved over within a week.",
  },
  {
    q: "How long does setup take?",
    a: "We do it with you. Every new company gets a hands-on setup: we build your first careers page, jobs and application form together, so you start with a working system rather than an empty one. There's no technical work on your side.",
  },
  {
    q: "What exactly does Ruby do, and can candidates opt out?",
    a: "Ruby reviews each application against your role, job description and policies, then asks the candidate a few friendly follow-up questions in their applicant portal. She only does this with their consent, and they can decline. She writes a clear report with a hire recommendation. It's advisory: your team always makes the decision.",
  },
  {
    q: "Is our candidate and staff data safe?",
    a: "Yes. Data is hosted in the UK (London), every company's data is isolated from every other company's, files live in private storage with controlled access, and role-based permissions control who on your team sees what. Built for UK GDPR from day one.",
  },
  {
    q: "Will my team actually use it?",
    a: "It's designed for busy registered managers, not IT departments. If your team can use WhatsApp and a whiteboard, they can use this: one board, clear next steps on every candidate, and reminders that chase paperwork so your team doesn't have to.",
  },
  {
    q: "Are there any hidden costs?",
    a: "No. The price on this page is the price: £49 or £89 a month, with add-ons listed openly (extra branches, extra SMS, AI actions). No per-user fees, no compulsory setup packages, no need to contact sales to find out.",
  },
];

const FOUNDING = [
  "Founding-customer pricing and special offers, kept while you stay",
  "Hands-on setup: we'll build your first careers page and jobs with you",
  "A direct line to shape what we build next",
];

export default function LandingPage() {
  const selfServe = selfServeEnabled();
  return (
    <main className="min-h-screen bg-white">
      {/* Sticky nav */}
      <header className={`${NAVY_SECTION} sticky top-0 z-40 shadow-md`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <a href="#top" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/jcn-mark-white.png" alt="" className="h-10 w-auto drop-shadow-sm sm:h-11" />
            <Wordmark />
          </a>
          <nav className="flex items-center gap-4 sm:gap-6">
            <a href="#ruby" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Meet Ruby</a>
            <a href="#platform" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Platform</a>
            <a href="#pricing" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Pricing</a>
            <a href="#faq" className="hidden text-sm font-medium text-white/85 hover:text-white md:inline">FAQ</a>
            <Link href="/sign-in" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Sign in</Link>
            {selfServe ? (
              <>
                <a href="#demo" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Book a demo</a>
                <Link href="/start" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#081231] shadow-sm transition hover:bg-amber-300">Start free trial</Link>
              </>
            ) : (
              <a href="#demo" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#081231] shadow-sm transition hover:bg-amber-300">Book a demo</a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pb-28 sm:pt-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Founding customer offers available
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Hire compliant care staff faster.{" "}
                <span className="-mb-2 inline-block bg-gradient-to-r from-rose-300 via-rose-200 to-amber-200 bg-clip-text pb-2 text-transparent">Ruby</span>,
                your AI assistant, screens every applicant for you.
              </h1>
              <p className="mt-6 text-lg text-white/85">
                One calm system from advert to first shift: track every applicant, capture every
                check, stay inspection-ready. And while you work, Ruby reviews each application,
                chats with the candidate, and tells you who&apos;s worth meeting.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                {selfServe ? (
                  <>
                    <Link href="/start" className={GOLD_BTN}>
                      Start free trial <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <a href="#demo" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20">
                      Book a demo
                    </a>
                  </>
                ) : (
                  <>
                    <a href="#demo" className={GOLD_BTN}>
                      Book a demo <ArrowRight className="h-4 w-4" aria-hidden />
                    </a>
                    <a href="#pricing" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20">
                      See pricing
                    </a>
                  </>
                )}
              </div>
              <p className="mt-4 text-sm text-white/70">
                {selfServe ? "Free trial · No obligation · Set up in minutes" : "No hard sell · No obligation · No setup fee on annual plans"}
              </p>
            </div>
            <div className="pb-10 sm:pb-12">
              <RubyDemo />
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-14 grid grid-cols-2 gap-4 border-t border-white/10 pt-10 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.small} className="text-center lg:text-left">
                <p className="text-3xl font-bold text-amber-300 sm:text-4xl">{s.big}</p>
                <p className="mt-1 text-sm text-white/75">{s.small}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Ruby — the differentiator */}
      <section id="ruby" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-6 pt-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-800 via-rose-700 to-red-700 p-8 text-white shadow-lg sm:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Meet Ruby
              </span>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Ruby, Your AI Recruitment Assistant</h2>
              <p className="mt-3 text-white/90">
                First-round screening is the most time-hungry part of care hiring: reading
                applications, spotting the gaps, playing phone tag for answers. Ruby does all
                of it for you. She reviews each applicant against your role, asks them a few
                friendly follow-up questions in their portal, and hands your team a clear
                report with a hire recommendation, so your time goes on the candidates worth
                meeting.
              </p>
              <p className="mt-4 text-sm text-white/80">
                Included on the <span className="font-semibold text-white">Core + Ruby</span> plan:
                40 applicants screened each month, then just 75p each. That&apos;s first-round
                screening handled for about £1 an applicant.
              </p>
              <p className="mt-2 text-xs text-white/60">
                Consent-based and advisory. Candidates agree to chat with Ruby, and your team
                always makes the final hiring decision.
              </p>
              <a href="#demo" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-sm font-semibold text-[#081231] transition hover:bg-amber-300">
                See Ruby in a demo <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icon: FileCheck2, title: "1. Reviews the application", body: "Reads the form, CV, your job description and policies to spot gaps and strengths." },
                { icon: MessageSquare, title: "2. Asks the candidate", body: "Holds a short, friendly follow-up conversation, always with the applicant's consent." },
                { icon: Sparkles, title: "3. Writes it up", body: "Turns their answers into a clear, fair screening report your team can read in seconds." },
                { icon: UserCheck, title: "4. Recommends", body: "Gives a plain hire recommendation: proceed, proceed with caution, or not a fit." },
              ].map((s) => (
                <div key={s.title} className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                  <s.icon className="h-6 w-6" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-white/85">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform showcases */}
      <section id="platform" className="mx-auto max-w-5xl scroll-mt-20 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">One calm system for the whole journey</h2>
          <p className="mt-3 text-gray-600">
            Advert, applicants, checks, contracts, messages, staff record. Everything in one
            place, simple enough for a busy registered manager.
          </p>
        </div>
        <div className="mt-14 space-y-16">
          {SHOWCASES.map((s, i) => (
            <div key={s.kicker} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{s.kicker}</p>
                <h3 className="mt-3 text-2xl font-bold text-gray-900">{s.title}</h3>
                <p className="mt-4 text-gray-600">{s.body}</p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 === 1 ? "lg:order-1" : ""}>{s.mock}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-gray-500">
          Join Care Now helps you stay organised and evidence safe recruitment. It does not
          replace your own checks; legal responsibility for compliance stays with your organisation.
        </p>
      </section>

      {/* Before / after strip */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Recruitment shouldn&apos;t feel like firefighting
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
            If hiring lives across spreadsheets, inboxes and sticky notes, things slip. And in
            care, the things that slip are the ones an inspector asks about.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMS.map((p) => (
              <div key={p.pain} className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="text-sm font-medium text-gray-400 line-through decoration-gray-300">{p.pain}</p>
                <p className="mt-2 flex items-start gap-2 text-base font-medium text-gray-900">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {p.fix}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
          Better than the way you&apos;re doing it now
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
          Most care firms run hiring on spreadsheets or a general-purpose project tool. Both
          work, until a candidate slips through or an inspector asks for evidence.
        </p>
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3.5 font-semibold sm:px-6">What you need</th>
                <th className="px-3 py-3.5 text-center font-semibold">Spreadsheets<br className="sm:hidden" /> &amp; inboxes</th>
                <th className="px-3 py-3.5 text-center font-semibold">Generic project tools</th>
                <th className="bg-[#0d1d4b] px-3 py-3.5 text-center font-semibold text-amber-300">Join Care Now</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3.5 font-medium text-gray-800 sm:px-6">{row.label}</td>
                  <td className="px-3 py-3.5 text-center">
                    <X className="mx-auto h-4 w-4 text-gray-300" aria-hidden />
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <X className="mx-auto h-4 w-4 text-gray-300" aria-hidden />
                  </td>
                  <td className="bg-amber-50/70 px-3 py-3.5 text-center">
                    <Check className="mx-auto h-4 w-4 text-amber-600" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ROI band */}
      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">It pays for itself in time alone</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/85">
            At £49 a month, Join Care Now costs less than a couple of hours of admin. It&apos;s
            built to give you those hours back every single week. Add Ruby and the maths gets
            even better: first-round screening on 40 applicants a month, handled for about £1
            each, without a single phone-tag afternoon.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <Sparkles className="mx-auto h-6 w-6 text-amber-300" aria-hidden />
              <p className="mt-3 text-sm text-white/85">First-round screening done by Ruby, not your evenings</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <ShieldCheck className="mx-auto h-6 w-6 text-amber-300" aria-hidden />
              <p className="mt-3 text-sm text-white/85">Evidence ready, so inspections stop being a scramble</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <Heart className="mx-auto h-6 w-6 text-amber-300" aria-hidden />
              <p className="mt-3 text-sm text-white/85">Fewer dropped carers, so fewer uncovered shifts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Simple, honest pricing</h2>
          <p className="mt-3 text-gray-600">
            Two plans, no quote-chasing and no hidden fees. Core compliance (Right to Work, DBS
            and references) is always in the base, never an add-on. Add <span className="font-semibold text-gray-900">Ruby</span>,
            your AI recruitment assistant, when you&apos;re ready.
          </p>
        </div>

        <PricingTiers />

        {/* Add-ons (shared) */}
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

      {/* How it works */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">From advert to hired in four steps</h2>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0d1d4b] text-lg font-bold text-amber-300">{s.n}</span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-20">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">Questions care managers ask us</h2>
        <div className="mt-10 space-y-3">
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
      </section>

      {/* Founding customers */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-8 sm:p-12">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0d1d4b] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Founding customers
              </span>
              <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">Book a demo now for special founding-customer offers</h2>
              <p className="mt-4 text-gray-600">
                We&apos;re building Join Care Now hand in hand with a small group of UK care
                providers. Get in early and you&apos;ll get our best pricing and special offers,
                real help getting set up, and a genuine say in what we build next.
              </p>
              <a href="#demo" className={`mt-6 ${NAVY_BTN}`}>
                Book a demo <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
            <ul className="space-y-3">
              {FOUNDING.map((pt) => (
                <li key={pt} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white p-4 text-sm font-medium text-gray-800">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Demo / final CTA */}
      <section id="demo" className={`${NAVY_SECTION} relative scroll-mt-20 overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 py-20">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">See it on your own roles</h2>
              <p className="mt-4 text-white/85">
                Book a short, no-pressure demo. We&apos;ll show you how Join Care Now works
                for your setting and answer your questions. Tell us a little about your
                organisation and we&apos;ll be in touch to arrange a time.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white/85">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-300" aria-hidden /> Built for UK care providers</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-300" aria-hidden /> Watch Ruby screen a real application, live</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-300" aria-hidden /> No obligation, no hard sell</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-300" aria-hidden /> Your data handled with care, isolated per company</li>
              </ul>
            </div>
            <div className="text-gray-900">
              <DemoForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#081231] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <div>
              <span className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/jcn-mark-white.png" alt="" className="h-9 w-auto" />
                <Wordmark className="text-xl" />
              </span>
              <p className="mt-3 max-w-xs text-sm text-white/60">
                Recruitment and onboarding for UK care providers, with Ruby, Your AI
                Recruitment Assistant.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">Product</p>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-white/70">
                <a href="#ruby" className="hover:text-white">Meet Ruby</a>
                <Link href="/features" className="hover:text-white">Features</Link>
                <Link href="/pricing" className="hover:text-white">Pricing</Link>
                <Link href="/guides" className="hover:text-white">Guides</Link>
                <a href="#faq" className="hover:text-white">FAQ</a>
                <a href="#demo" className="hover:text-white">Book a demo</a>
              </nav>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">Company</p>
              <nav className="mt-3 flex flex-col gap-2 text-sm text-white/70">
                <Link href="/privacy" className="hover:text-white">Privacy</Link>
                <Link href="/sign-in" className="hover:text-white">Account Sign In</Link>
              </nav>
            </div>
          </div>
          <p className="mt-10 border-t border-white/10 pt-6 text-sm text-white/40">
            © {new Date().getFullYear()} Join Care Now · joincarenow.com
          </p>
        </div>
      </footer>
    </main>
  );
}
