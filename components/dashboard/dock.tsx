"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Briefcase, KanbanSquare, CalendarClock, Users, ClipboardCheck,
  IdCard, FileText, Store, MessageSquareText, BarChart3, Settings,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, grad: "from-slate-500 to-slate-700" },
  { href: "/jobs", label: "Jobs", icon: Briefcase, grad: "from-teal-400 to-teal-600" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, grad: "from-indigo-400 to-indigo-600" },
  { href: "/interviews", label: "Interviews", icon: CalendarClock, grad: "from-violet-400 to-violet-600" },
  { href: "/applicants", label: "Applicants", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/onboarding-board", label: "Workflow", icon: ClipboardCheck, grad: "from-emerald-400 to-emerald-600" },
  { href: "/employees", label: "Employees", icon: IdCard, grad: "from-cyan-400 to-cyan-600" },
  { href: "/forms", label: "Forms", icon: FileText, grad: "from-amber-400 to-amber-500" },
  { href: "/templates", label: "Templates", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
  { href: "/store", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/reports", label: "Reports", icon: BarChart3, grad: "from-blue-400 to-blue-600" },
  { href: "/settings", label: "Settings", icon: Settings, grad: "from-gray-400 to-gray-600" },
];

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/dashboard") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/50 bg-white/70 px-2.5 py-2 shadow-xl backdrop-blur-xl">
        {ITEMS.map(({ href, label, icon: Icon, grad }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              aria-label={label}
              className={`group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow transition-transform hover:-translate-y-1 ${
                active ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-white/60" : ""
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
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
