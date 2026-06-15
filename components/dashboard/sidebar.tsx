"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
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
    <aside className="hidden md:flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/dashboard" className="text-lg font-bold text-brand-700">
          Join Care Now
        </Link>
        <p className="mt-0.5 truncate text-xs text-gray-500">{companyName}</p>
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-700 hover:bg-gray-100"
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
