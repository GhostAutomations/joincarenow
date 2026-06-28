import Link from "next/link";

// Shown (with a 404) when a job is closed, filled or expired. Keeping a real
// 404 here is deliberate — Google for Jobs needs expired postings gone.
export default function JobClosedNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Role closed</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">This role is no longer available</h1>
        <p className="mt-3 text-sm text-gray-600">
          The vacancy you&apos;re looking for has closed or been filled. Other roles may still be open —
          head to the company&apos;s careers page to take a look.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to Join Care Now
        </Link>
      </div>
    </main>
  );
}
