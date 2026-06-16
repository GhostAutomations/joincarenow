import { requirePlatformAdmin } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";
import { FounderSidebar } from "@/components/dashboard/founder-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePlatformAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-700 to-indigo-800">
      <FounderSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-white/20 bg-white/70 px-4 backdrop-blur-md sm:px-6">
          <span className="md:hidden text-base font-bold text-brand-700">
            Join Care Now
          </span>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {profile?.full_name || profile?.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-gray-300 bg-white/60 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
