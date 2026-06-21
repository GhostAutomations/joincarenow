import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Join Care Now handles personal data submitted through our website.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-brand-700">Join Care Now</Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">← Back to home</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Privacy notice</h1>
        <p className="mt-2 text-sm text-gray-500">
          {/* PLACEHOLDER: confirm/replace this notice with your reviewed legal text before launch. */}
          This is a summary of how we use information you give us through this website.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-base font-semibold text-gray-900">Who we are</h2>
            <p className="mt-2">
              Join Care Now (&quot;we&quot;, &quot;us&quot;) provides recruitment and onboarding
              software for care providers. For data you submit on this website, we are the
              data controller. {" "}
              {/* PLACEHOLDER: registered company name, address and ICO registration number. */}
              <span className="text-gray-400">[PLACEHOLDER: company name, address and ICO registration number]</span>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">What we collect and why</h2>
            <p className="mt-2">
              When you request a demo we collect your name, company, role, email address and
              (optionally) your phone number and care setting. We use this only to contact you
              about a demo and to respond to your enquiry. Our lawful basis is your consent and
              our legitimate interest in responding to business enquiries.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">How long we keep it</h2>
            <p className="mt-2">
              We keep enquiry details only as long as needed to deal with your request and for a
              reasonable period afterwards. {" "}
              <span className="text-gray-400">[PLACEHOLDER: confirm retention period]</span>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">Your rights</h2>
            <p className="mt-2">
              You can ask us to access, correct or delete your data, or to stop contacting you, at
              any time. To do so, email {" "}
              <span className="text-gray-400">[PLACEHOLDER: privacy contact email]</span>. You also
              have the right to complain to the Information Commissioner&apos;s Office (ICO).
            </p>
          </section>
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long" })}.
        </p>
      </div>
    </main>
  );
}
