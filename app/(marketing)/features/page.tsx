import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Check, Globe, LayoutGrid, MessageSquare, ShieldCheck,
  FileSignature, UserCog, Sparkles, ClipboardCheck,
} from "lucide-react";
import { MarketingHeader, MarketingFooter, MarketingCta, GOLD_BTN, NAVY_SECTION } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Features: care recruitment & onboarding software | Join Care Now",
  description:
    "Everything Join Care Now does for UK care providers: branded careers pages, an applicant pipeline, full onboarding (Right to Work, DBS, references, contracts), email and SMS, a master employee record, and Ruby, your AI screening assistant.",
  alternates: { canonical: "https://www.joincarenow.com/features" },
  openGraph: {
    title: "Features | Join Care Now",
    description:
      "Branded careers pages, applicant tracking, full onboarding, email and SMS, a master employee record, and Ruby, your AI screening assistant. Built for UK care.",
    url: "https://www.joincarenow.com/features",
    siteName: "Join Care Now",
    locale: "en_GB",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: Globe,
    kicker: "Careers pages",
    title: "Advertise every role under your own brand",
    body: "Each job sits on a branded careers page that candidates find on Google and apply to from any phone. No job-board fees, no third-party branding, and roles close automatically on your closing date.",
    points: ["Found on Google for Jobs", "Share links, social posts and QR posters", "Your own application form on every role"],
  },
  {
    icon: LayoutGrid,
    kicker: "Applicant pipeline",
    title: "See every candidate, never lose one",
    body: "A simple board shows every applicant and exactly what each one is waiting on. In care the best people are gone in days, so your team can see who needs a nudge and move them from applied to first shift without the gaps.",
    points: ["Drag-and-drop hiring stages", "Progress and missing items on every card", "Board and table views, search and filters"],
  },
  {
    icon: ClipboardCheck,
    kicker: "Onboarding & checks",
    title: "Collect every check in one place",
    body: "Right to Work, DBS, references, employment history, documents and declarations are requested, chased and stored against the person. When an inspector asks, the evidence is already there and time-stamped.",
    points: ["Right to Work, DBS and references tracked", "Document requests with approval and expiry", "Reusable onboarding workflows per role"],
  },
  {
    icon: FileSignature,
    kicker: "Contracts & policies",
    title: "Sign contracts and policies online",
    body: "Build your contracts and policies once, then have new starters read and sign them in their portal. Every signature is captured with a time-stamped record and filed to the person's staff record on hire.",
    points: ["Build or AI-generate documents", "Sign on accept, typed or drawn", "Sealed copy filed to the employee record"],
  },
  {
    icon: MessageSquare,
    kicker: "Communication hub",
    title: "Email and SMS without leaving the system",
    body: "Message candidates by email or text with templates and merge fields, see what is delivered and opened, and keep the whole conversation on the applicant's timeline instead of losing it in someone's inbox.",
    points: ["Templates with merge fields", "Delivery and open tracking", "Automatic reminders that chase paperwork"],
  },
  {
    icon: UserCog,
    kicker: "Employee record",
    title: "One record from advert to first shift",
    body: "When you hire someone, their application becomes a permanent employee record with an ID and their full history kept. No re-typing across spreadsheets, and a single source of truth for everything that comes next.",
    points: ["Applicant converts to employee on hire", "Full history retained", "Leaver flow and staff-file export"],
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero */}
      <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
        <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Everything in one calm system
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            One system from advert to first shift
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
            Join Care Now brings the whole of care hiring into one place: advertise roles, track
            applicants, collect every check, sign contracts and message candidates, then keep it
            all on a permanent staff record. And Ruby handles first-round screening for you.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/#demo" className={GOLD_BTN}>Book a demo <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">See pricing</Link>
          </div>
        </div>
      </section>

      {/* Ruby callout */}
      <section className="mx-auto max-w-5xl px-6 pt-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-800 via-rose-700 to-red-700 p-8 text-white shadow-lg sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Meet Ruby
          </span>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">First-round screening, handled for you</h2>
          <p className="mt-3 max-w-3xl text-white/90">
            Ruby reviews each applicant against your role, asks them a few friendly follow-up
            questions in their portal with their consent, and writes a clear report with a hire
            recommendation. Your team keeps every decision. It is included on the Core plus Ruby
            plan: 40 applicants a month, then 75p each.
          </p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="space-y-6">
          {FEATURES.map((f) => (
            <div key={f.kicker} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0d1d4b] text-amber-300">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{f.kicker}</p>
                  <h3 className="mt-1 text-xl font-bold text-gray-900">{f.title}</h3>
                  <p className="mt-3 max-w-2xl text-gray-600">{f.body}</p>
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {f.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                          <Check className="h-3 w-3" aria-hidden />
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500">
          Join Care Now helps you stay organised and evidence safe recruitment under CQC Regulation
          19 and the equivalent CIW expectations. It supports your checks; it does not replace them,
          and legal responsibility for compliance stays with your organisation.{" "}
          <Link href="/guides" className="font-medium text-amber-700 hover:underline">Read our compliance guides</Link>.
        </p>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
