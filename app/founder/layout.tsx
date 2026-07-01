import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";
import { FounderDock } from "@/components/dashboard/founder-dock";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePlatformAdmin();

  return (
    <div className="jcn-app flex h-screen flex-col overflow-hidden jcn-app-bg">
      <header className="flex h-14 items-center justify-between border-b border-white/20 bg-white/70 px-4 backdrop-blur-md sm:px-6">
        <Link
          href="/founder"
          className="flex items-center gap-2 text-base font-bold text-brand-700 hover:text-brand-800"
        >
          <LayoutGrid className="h-5 w-5" aria-hidden />
          Join Care Now
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            {profile?.full_name || profile?.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
        {children}
      </main>
      <FounderDock />
    </div>
  );
}
