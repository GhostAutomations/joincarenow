"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGrid, Briefcase, KanbanSquare, CalendarClock, Users, ClipboardCheck,
  IdCard, FileText, Store, MessageSquareText, BarChart3, Settings, ShieldCheck,
  CreditCard, MessageSquarePlus, Lightbulb,
} from "lucide-react";
import { ResponsiveDock } from "@/components/dashboard/responsive-dock";

const BASE = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, grad: "from-slate-500 to-slate-700" },
  { href: "/jobs", label: "Jobs", icon: Briefcase, grad: "from-teal-400 to-teal-600" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, grad: "from-indigo-400 to-indigo-600" },
  { href: "/interviews", label: "Interviews", icon: CalendarClock, grad: "from-violet-400 to-violet-600" },
  { href: "/applicants", label: "Talent Pool", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/onboarding-board", label: "Workflow", icon: ClipboardCheck, grad: "from-emerald-400 to-emerald-600" },
  { href: "/referencing", label: "Referencing", icon: ShieldCheck, grad: "from-lime-400 to-lime-600" },
  { href: "/employees", label: "Employees", icon: IdCard, grad: "from-cyan-400 to-cyan-600" },
  { href: "/forms", label: "Forms", icon: FileText, grad: "from-amber-400 to-amber-500" },
  { href: "/templates", label: "Templates", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
  { href: "/store", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/reports", label: "Reports", icon: BarChart3, grad: "from-blue-400 to-blue-600" },
];

// Admin-only apps: billing, settings/team management, and the Form Store (paid forms).
const ADMIN_ITEMS = [
  { href: "/store", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/billing", label: "Billing", icon: CreditCard, grad: "from-amber-400 to-amber-500" },
  { href: "/settings", label: "Settings", icon: Settings, grad: "from-gray-400 to-gray-600" },
];

export function Dock({ feedbackOpen = false, isAdmin = false }: { feedbackOpen?: boolean; isAdmin?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;

  const ITEMS = [
    ...BASE,
    ...(feedbackOpen ? [{ href: "/feedback", label: "Feedback", icon: MessageSquarePlus, grad: "from-fuchsia-400 to-fuchsia-600" }] : []),
    ...(isAdmin ? ADMIN_ITEMS : []),
    ...(isAdmin ? [{ href: "/requests", label: "Requests", icon: Lightbulb, grad: "from-yellow-400 to-amber-500" }] : []),
  ];

  return (
    <ResponsiveDock
      items={ITEMS}
      primary={["/dashboard", "/jobs", "/pipeline", "/onboarding-board"]}
    />
  );
}
