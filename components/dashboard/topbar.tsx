import Link from "next/link";
import { signOut } from "@/modules/auth/actions";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";

export function Topbar({
  userName,
  showHome = false,
  logoUrl = null,
  companyName = "Join Care Now",
}: {
  userName: string;
  showHome?: boolean;
  logoUrl?: string | null;
  companyName?: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/40 bg-white/70 px-4 backdrop-blur-md sm:px-6">
      {showHome ? (
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-base font-bold text-brand-700 hover:text-brand-800"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto max-w-[140px] object-contain" />
          ) : (
            companyName
          )}
        </Link>
      ) : (
        <>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto max-w-[140px] object-contain md:hidden" />
          ) : (
            <span className="md:hidden text-base font-bold text-brand-700">{companyName}</span>
          )}
          <div className="hidden md:block" />
        </>
      )}
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
