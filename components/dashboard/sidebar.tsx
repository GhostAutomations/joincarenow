"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
  CalendarClock,
  Users,
  ClipboardCheck,
  IdCard,
  FileText,
  Store,
  MessageSquareText,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/applicants", label: "Applicants", icon: Users },
  { href: "/onboarding-board", label: "Workflow", icon: ClipboardCheck },
  { href: "/employees", label: "Employees", icon: IdCard },
  { href: "/forms", label: "Forms", icon: FileText },
  { href: "/store", label: "Form Store", icon: Store },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col bg-gradient-to-b from-teal-600 via-cyan-700 to-indigo-800 text-white">
      <div className="px-5 py-5 border-b border-white/15">
        <Link href="/dashboard" className="text-lg font-bold text-white">
          Join Care Now
        </Link>
        <p className="mt-0.5 truncate text-xs text-white/60">{companyName}</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
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
