import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-brand-700">
            Join Care Now
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-gray-700 hover:text-brand-700"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
            Recruitment &amp; onboarding,
            <span className="text-brand-600"> built for care providers</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600">
            Advertise jobs, track applicants, complete onboarding and create
            employee records — with staff flowing automatically into your
            training platform. No spreadsheets, no re-keying.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-700"
            >
              Start free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Join Care Now · joincarenow.com
      </footer>
    </main>
  );
}
