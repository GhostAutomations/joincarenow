import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-base font-bold text-brand-700">
            Join Care Now
          </span>
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
            Founder
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-700 sm:inline">
            {profile?.full_name || profile?.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <nav className="border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl gap-1">
          <Link
            href="/admin"
            className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Companies
          </Link>
          <Link
            href="/admin/forms"
            className="border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-brand-700"
          >
            Form Store
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
