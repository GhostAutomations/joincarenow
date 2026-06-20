"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Building2, Store, MessageSquareText, ListChecks, Users, ScrollText, Plug } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Home", icon: LayoutGrid, grad: "from-slate-500 to-slate-700" },
  { href: "/admin/companies", label: "Companies", icon: Building2, grad: "from-teal-400 to-teal-600" },
  { href: "/admin/users", label: "Users", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, grad: "from-violet-400 to-violet-600" },
  { href: "/admin/integrations", label: "Integrations", icon: Plug, grad: "from-emerald-400 to-emerald-600" },
  { href: "/admin/forms", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/admin/questions", label: "Question Bank", icon: ListChecks, grad: "from-amber-400 to-amber-500" },
  { href: "/admin/sms", label: "SMS Usage", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
];

export function FounderDock() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/admin") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/50 bg-white/70 px-2.5 py-2 shadow-xl backdrop-blur-xl">
        {ITEMS.map(({ href, label, icon: Icon, grad }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              aria-label={label}
              className={`group relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow transition-transform hover:-translate-y-1 ${
                active ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-white/60" : ""
              }`}
            >
              <Icon className="h-8 w-8" strokeWidth={1.9} />
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity duration-75 group-hover:opacity-100">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
