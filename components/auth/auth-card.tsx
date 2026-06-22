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
    <main className="jcn-app-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="jcn-blob pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      <div className="jcn-blob jcn-blob-3 pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-white drop-shadow-sm">
            Join Care Now
          </Link>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white p-8 shadow-2xl ring-1 ring-black/5">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
