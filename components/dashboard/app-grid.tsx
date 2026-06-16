"use client";

import { useRouter } from "next/navigation";
import {
  Briefcase, KanbanSquare, CalendarClock, Users, ClipboardCheck,
  IdCard, FileText, Store, MessageSquareText, BarChart3, Settings,
} from "lucide-react";

const APPS = [
  { href: "/jobs", label: "Jobs", icon: Briefcase, grad: "from-teal-400 to-teal-600" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, grad: "from-indigo-400 to-indigo-600", badgeKey: "applicants" },
  { href: "/interviews", label: "Interviews", icon: CalendarClock, grad: "from-violet-400 to-violet-600", badgeKey: "interviews" },
  { href: "/applicants", label: "Talent Pool", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/onboarding-board", label: "Workflow", icon: ClipboardCheck, grad: "from-emerald-400 to-emerald-600", badgeKey: "workflow" },
  { href: "/employees", label: "Employees", icon: IdCard, grad: "from-cyan-400 to-cyan-600" },
  { href: "/forms", label: "Forms", icon: FileText, grad: "from-amber-400 to-amber-500" },
  { href: "/templates", label: "Templates", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
  { href: "/store", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/reports", label: "Reports", icon: BarChart3, grad: "from-blue-400 to-blue-600" },
  { href: "/settings", label: "Settings", icon: Settings, grad: "from-slate-400 to-slate-600" },
] as const;

export function AppGrid({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  return (
    <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-6">
      {APPS.map(({ href, label, icon: Icon, grad, ...rest }) => {
        const badge = "badgeKey" in rest ? counts[(rest as { badgeKey: string }).badgeKey] ?? 0 : 0;
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="group flex flex-col items-center gap-2"
          >
            <div className={`relative grid h-[68px] w-[68px] place-items-center rounded-[20px] bg-gradient-to-br ${grad} border border-white/30 shadow-lg transition-transform group-hover:-translate-y-1`}>
              <Icon className="h-8 w-8 text-white" strokeWidth={1.8} />
              {badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full border-2 border-teal-700 bg-rose-500 px-1 text-[11px] font-semibold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className="text-[13px] font-medium text-white">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
