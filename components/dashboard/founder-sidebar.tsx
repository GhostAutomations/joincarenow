"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Companies", icon: Building2, exact: true },
  { href: "/admin/forms", label: "Form Store", icon: Store, exact: false },
];

export function FounderSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col jcn-rail-bg text-white">
      <div className="border-b border-white/15 px-5 py-5">
        <Link href="/admin" className="text-lg font-bold text-white">
          Join Care Now
        </Link>
        <p className="mt-0.5 text-xs font-medium text-white/60">Founder</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/20 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
