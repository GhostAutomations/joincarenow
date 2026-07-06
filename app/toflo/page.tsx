import type { Metadata } from "next";
import { Sparkles, Users, ClipboardCheck, MessageSquare } from "lucide-react";
import { WaitlistForm } from "@/components/toflo/waitlist-form";
import { TofloDemo } from "@/components/toflo/toflo-demo";

export const metadata: Metadata = {
  title: "Toflo — modern hiring software, coming soon",
  description:
    "Toflo is an all-in-one hiring platform: post roles, track applicants, screen with AI and onboard new starters in one place. Modern hiring without enterprise pricing. Join the waitlist.",
  alternates: { canonical: "https://toflo.co.uk" },
  openGraph: {
    title: "Toflo — modern hiring software, coming soon",
    description: "Post roles, track applicants, screen with AI and onboard, all in one place. Join the waitlist.",
    siteName: "Toflo",
    type: "website",
  },
};

const FEATURES = [
  { icon: Users, title: "Track every applicant", body: "One clear pipeline from applied to hired. Never lose a good candidate." },
  { icon: Sparkles, title: "AI screening built in", body: "Let AI handle first-round screening and hand you a clear recommendation." },
  { icon: ClipboardCheck, title: "Onboard in one place", body: "Documents, checks and contracts, collected and signed online." },
  { icon: MessageSquare, title: "Message without leaving", body: "Email and SMS candidates from one timeline, with templates and tracking." },
];

export default function TofloComingSoon() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        {/* Wordmark */}
        <header>
          <span className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">Toflo</span>
          </span>
        </header>

        {/* Hero */}
        <section className="flex flex-1 flex-col justify-center py-14">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Coming soon
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Modern hiring software, without the enterprise price tag.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/70">
                Post roles, track every applicant, screen with AI and onboard your new starters, all
                in one simple platform, for any industry. Toflo is launching soon. Join the waitlist
                to be first in.
              </p>
              <div className="mt-9">
                <WaitlistForm />
              </div>
            </div>

            <div className="pb-10 lg:pb-12">
              <TofloDemo />
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <f.icon className="h-6 w-6 text-emerald-300" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/40">
          © {new Date().getFullYear()} Toflo
        </footer>
      </div>
    </main>
  );
}
