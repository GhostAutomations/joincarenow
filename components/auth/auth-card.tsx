import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#081231] via-[#0d1d4b] to-[#14306b] px-4">
      <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="-mb-1 inline-block bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text pb-1 text-transparent drop-shadow-sm">
              Join Care Now
            </span>
          </Link>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white p-8 shadow-2xl ring-1 ring-black/5">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center">
          <Link href="/" className="text-sm font-medium text-white/70 transition hover:text-amber-300">
            ← Back to the homepage
          </Link>
        </p>
      </div>
    </main>
  );
}
