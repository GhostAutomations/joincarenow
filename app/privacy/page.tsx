import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice | Join Care Now",
  description: "How Join Care Now collects, uses and protects personal data.",
};

const LAST_UPDATED = "4 July 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="border-l-4 border-amber-400 pl-3 text-lg font-bold text-gray-900">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-[#081231] via-[#0d1d4b] to-[#14306b] shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              Join Care Now
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-white/80 transition hover:text-amber-300">
            ← Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Privacy notice</h1>
        <p className="mt-2 text-sm text-gray-500">
          This notice explains how Join Care Now collects, uses and protects personal data,
          both on this website and inside our platform. We keep it in plain English on purpose.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <H2>Who we are</H2>
            <p className="mt-3">
              Join Care Now (&quot;we&quot;, &quot;us&quot;) provides recruitment and onboarding
              software for UK care providers at joincarenow.com.{" "}
              <span className="rounded bg-amber-50 px-1 text-amber-800">[Company legal name, registered address and ICO registration number to follow]</span>
            </p>
          </section>

          <section>
            <H2>Two roles: this website and the platform</H2>
            <p className="mt-3">
              For data you submit on this website (for example a demo enquiry), we are the{" "}
              <strong>data controller</strong>.
            </p>
            <p className="mt-3">
              Inside the platform it works differently. When you apply for a job with a care
              company, or work for one that uses Join Care Now, that company is the data
              controller and we are their <strong>data processor</strong>: we handle your
              information on their instructions, under a data processing agreement. If you have
              questions about how a care company uses your data, or want to exercise your
              rights over an application you made, contact that company directly. We will help
              them respond.
            </p>
          </section>

          <section>
            <H2>What we collect on this website, and why</H2>
            <p className="mt-3">
              When you request a demo we collect your name, company, role, email address and,
              if you choose to give them, your phone number and care setting. We use this to
              respond to your enquiry and arrange the demo. Our lawful bases are your consent
              and our legitimate interest in responding to business enquiries.
            </p>
            <p className="mt-3">
              If you email us (for example at sales@joincarenow.com) we keep the correspondence
              so we can deal with your enquiry.
            </p>
          </section>

          <section>
            <H2>What the platform processes</H2>
            <p className="mt-3">
              On behalf of care companies, the platform processes the information involved in
              recruitment and onboarding: applications, CVs, right to work and DBS check
              records, references, contracts and signatures, messages between the company and
              the candidate, and employee records after hire. Where a company uses Ruby, our AI
              assistant, application answers are also processed to produce a screening report.
              Ruby only messages candidates with their consent, her output is advisory, and the
              hiring decision is always made by people.
            </p>
          </section>

          <section>
            <H2>Who helps us provide the service</H2>
            <p className="mt-3">
              We do not sell personal data, and we do not share it with advertisers. We use a
              small number of service providers to run Join Care Now: Supabase (database and
              file storage, hosted in London), Vercel (website hosting), Stripe (payments),
              Resend (email delivery), Twilio (text messages) and Anthropic (AI processing for
              Ruby). Each provider only processes data to provide their service to us. Where a
              provider processes data outside the UK, we rely on UK GDPR approved safeguards
              such as the UK Addendum to standard contractual clauses.
            </p>
          </section>

          <section>
            <H2>How we protect it</H2>
            <p className="mt-3">
              Data is stored in the UK (London). Every company&apos;s data is isolated from
              every other company&apos;s at the database level, files are held in private
              storage behind short-lived secure links, access is controlled by role-based
              permissions, and data is encrypted in transit. Downloads of sensitive documents
              are logged.
            </p>
          </section>

          <section>
            <H2>Cookies</H2>
            <p className="mt-3">
              We use essential cookies only: the ones needed to keep you signed in and to keep
              the service secure. We do not use advertising or cross-site tracking cookies.
            </p>
          </section>

          <section>
            <H2>How long we keep it</H2>
            <p className="mt-3">
              Website enquiries are kept for as long as needed to deal with your request, and
              for no more than 12 months after our last contact unless you become a customer.
              Data inside the platform is kept according to each care company&apos;s own
              retention policy, as controller, and the requirements placed on them as regulated
              care providers.
            </p>
          </section>

          <section>
            <H2>Your rights</H2>
            <p className="mt-3">
              You have the right to access your data, correct it, ask for it to be deleted,
              restrict or object to how it is used, receive a copy of it, and withdraw consent
              at any time. To exercise any of these for data we control, email{" "}
              <a href="mailto:privacy@joincarenow.com" className="font-medium text-[#0d1d4b] underline">
                privacy@joincarenow.com
              </a>
              . For data held by a care company you applied to or work for, contact that
              company. You also have the right to complain to the Information
              Commissioner&apos;s Office at{" "}
              <a href="https://ico.org.uk" className="font-medium text-[#0d1d4b] underline" rel="noopener noreferrer" target="_blank">
                ico.org.uk
              </a>
              .
            </p>
          </section>

          <section>
            <H2>Changes to this notice</H2>
            <p className="mt-3">
              If we change how we handle personal data we will update this notice and the date
              below.
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-gray-400">Last updated: {LAST_UPDATED}.</p>
      </div>
    </main>
  );
}
