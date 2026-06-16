import { signOut } from "@/modules/auth/actions";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";

export function Topbar({ userName }: { userName: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/40 bg-white/70 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile brand (sidebar hidden on small screens) */}
      <span className="md:hidden text-base font-bold text-brand-700">
        Join Care Now
      </span>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <NotificationsBell />
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
