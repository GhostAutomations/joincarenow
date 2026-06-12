import { signOut } from "@/modules/auth/actions";

export function Topbar({ userName }: { userName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* Mobile brand (sidebar hidden on small screens) */}
      <span className="md:hidden text-base font-bold text-brand-700">
        Join Care Now
      </span>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{userName}</span>
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
  );
}
