import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Shared navy-and-gold chrome for marketing sub-pages (features, pricing,
// guides). The homepage keeps its own single-page anchor nav; these pages are
// standalone routes, so their nav links to real URLs for SEO and crawlability.

export const NAVY_SECTION = "bg-gradient-to-br from-[#081231] via-[#0d1d4b] to-[#14306b]";
export const GOLD_BTN =
  "inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-sm font-semibold text-[#081231] shadow-sm transition hover:bg-amber-300";

export function Wordmark({ className = "text-xl sm:text-2xl" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="-mb-1 inline-block bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text pb-1 text-transparent drop-shadow-sm">
        Join Care Now
      </span>
    </span>
  );
}

export function MarketingHeader() {
  return (
    <header className={`${NAVY_SECTION} sticky top-0 z-40 shadow-md`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/jcn-mark-white.png" alt="" className="h-10 w-auto drop-shadow-sm sm:h-11" />
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/features" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Features</Link>
          <Link href="/pricing" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Pricing</Link>
          <Link href="/guides" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Guides</Link>
          <Link href="/sign-in" className="hidden text-sm font-medium text-white/85 hover:text-white sm:inline">Sign in</Link>
          <Link href="/#demo" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#081231] shadow-sm transition hover:bg-amber-300">Book a demo</Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[#081231] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/jcn-mark-white.png" alt="" className="h-9 w-auto" />
              <Wordmark className="text-xl" />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/60">
              Recruitment and onboarding for UK care providers, with Ruby, Your AI
              Recruitment Assistant.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">Product</p>
            <nav className="mt-3 flex flex-col gap-2 text-sm text-white/70">
              <Link href="/features" className="hover:text-white">Features</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/guides" className="hover:text-white">Guides</Link>
              <Link href="/#demo" className="hover:text-white">Book a demo</Link>
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
  );
}

/** A navy call-to-action band reused at the foot of each marketing sub-page. */
export function MarketingCta({
  title = "See it on your own roles",
  body = "Book a short, no-pressure demo. We will show you how Join Care Now works for your setting and answer your questions.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className={`${NAVY_SECTION} relative overflow-hidden text-white`}>
      <div className="jcn-blob pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/85">{body}</p>
        <div className="mt-8">
          <Link href="/#demo" className={GOLD_BTN}>
            Book a demo <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
